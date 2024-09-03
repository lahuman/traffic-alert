/**
 * 도로 돌발 정보 
 */
const { XMLParser } = require("fast-xml-parser");
const pgExecute = require('./db');
const progressBar = require('./progressBar');

const parser = new XMLParser();



// 날짜 문자열을 파싱하여 "YYYY-MM-DD HH:mm" 형식으로 변환하는 함수
function parseDate(dateString) {
    const datePattern = /(\d{4})년\s(\d{2})월\s(\d{2})일\s+(\d{2})시\s(\d{2})분/;
    const match = dateString.match(datePattern);

    if (match) {
        const [_, year, month, day, hour, minute] = match.map(Number);
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }

    // 기본적으로 현재 시간을 반환
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

// SQL 문을 생성하는 함수
function generateSQL(record) {
    return `
        INSERT INTO traffic_alert
            (ID, ADDRESS, TITLE, TYPE_CD, SUB_CD, LATITUDE, LONGITUDE, START_DTM, END_DTM, UPDATE_DTM)
        VALUES(
            '${record.incidentId}', 
            '${record.addressJibun}', 
            '${record.incidentTitle}', 
            '${record.incidenteTypeCd}', 
            '${record.incidenteSubTypeCd}', 
            ${record.locationDataY}, 
            ${record.locationDataX}, 
            '${parseDate(record.startDate)}', 
            '${parseDate(record.endDate)}', 
            '${parseDate(record.updateDate)}'
        )
        ON CONFLICT(ID) 
        DO UPDATE SET
            ADDRESS = EXCLUDED.ADDRESS,
            TITLE = EXCLUDED.TITLE,
            TYPE_CD = EXCLUDED.TYPE_CD,
            SUB_CD = EXCLUDED.SUB_CD,
            LATITUDE = EXCLUDED.LATITUDE,
            LONGITUDE = EXCLUDED.LONGITUDE,
            START_DTM = EXCLUDED.START_DTM,
            END_DTM = EXCLUDED.END_DTM,
            UPDATE_DTM = EXCLUDED.UPDATE_DTM;
    `;
}

// API에서 데이터를 가져오고 XML을 파싱하는 함수
async function fetchTrafficData() {
    const url = `http://www.utic.go.kr/guide/imsOpenData.do?key=${process.env.TRAFFIC_TOKEN}`;
    const resXml = await fetch(url).then(res => res.text());
    return parser.parse(resXml);
}

// 메인 함수
async function main() {
    const jObj = await fetchTrafficData();

    const sqlList = jObj.result.record.map(generateSQL);

    const loopLen = sqlList.length;
    const startTime = new Date();
    
    for (let i = 0; i < loopLen; i++) {
        progressBar.progressBar(i, loopLen, startTime);
        await pgExecute.unsafe(sqlList[i]);
    }

    pgExecute.end();
}

main();

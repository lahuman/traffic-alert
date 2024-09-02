const { XMLParser } = require("fast-xml-parser");
const pgExecute = require('./db');
const progressBar = require('./progressBar');

const parser = new XMLParser();

function parseDate(dateString) {
    // 정규식을 사용하여 날짜와 시간을 추출
    const datePattern = /(\d{4})년\s(\d{2})월\s(\d{2})일\s+(\d{2})시\s(\d{2})분/;
    const match = dateString.match(datePattern);

    if (match) {
        const year = parseInt(match[1], 10);
        const month = parseInt(match[2], 10);
        const day = parseInt(match[3], 10);
        const hour = parseInt(match[4], 10);
        const minute = parseInt(match[5], 10);

        // 커스텀 형식으로 문자열 생성
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }
    // 기본 날짜를 동일한 형식으로 반환
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

async function main() {

    const resXml = await fetch(`http://www.utic.go.kr/guide/imsOpenData.do?key=${process.env.TOKEN}`)
        .then(res => res.text());

    const jObj = parser.parse(resXml);

    const sqlList = jObj.result.record.map(r => `
        INSERT INTO public.traffic_alert
            ("ID", "ADDRESS", "TITLE", "TYPE_CD", "SUB_CD", "LATITUDE", "LONGITUDE", "START_DTM", "END_DTM", "UPDATE_DTM")
            VALUES('${r.incidentId}', '${r.addressJibun}', '${r.incidentTitle}', '${r.incidenteTypeCd}', '${r.incidenteSubTypeCd}', ${r.locationDataY}, ${r.locationDataX}, '${parseDate(r.startDate)}', '${parseDate(r.endDate)}', '${parseDate(r.updateDate)}')
                ON CONFLICT("ID") 
                DO UPDATE SET
                    "ADDRESS" = EXCLUDED."ADDRESS",
                    "TITLE" = EXCLUDED."TITLE",
                    "TYPE_CD" = EXCLUDED."TYPE_CD",
                    "SUB_CD" = EXCLUDED."SUB_CD",
                    "LATITUDE" = EXCLUDED."LATITUDE",
                    "LONGITUDE" = EXCLUDED."LONGITUDE",
                    "START_DTM" = EXCLUDED."START_DTM",
                    "END_DTM" = EXCLUDED."END_DTM",
                    "UPDATE_DTM" = EXCLUDED."UPDATE_DTM"
    `);


    let loop_len = sqlList.length;
    let startTime = new Date();
        
    for (let i = 0; i < sqlList.length; i++) {
        progressBar.progressBar(i, loop_len, startTime);
        // console.log(sqlList[i]);
        await pgExecute.unsafe(`${sqlList[i]}`);
        
    }

    pgExecute.end();
}

main();
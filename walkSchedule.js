/**
 * 보행자 정보 조회 후 저장 처리 
 */
const { XMLParser } = require("fast-xml-parser");
const pgExecute = require('./db');
const progressBar = require('./progressBar');

const parser = new XMLParser();


const sido_gugun_map_with_codes = {
    11: [680, 740, 305, 500, 620, 215, 530, 545, 350, 320, 230, 590, 440, 410, 650, 200, 290, 710, 470, 560, 170, 380, 110, 140, 260],
    26: [440, 410, 710, 290, 170, 260, 230, 320, 530, 380, 140, 500, 470, 200, 110, 350],
    27: [200, 290, 710, 140, 230, 170, 260, 110, 720],
    28: [710, 245, 170, 200, 140, 177, 237, 260, 185, 720, 110],
    29: [200, 155, 110, 170, 140],
    30: [230, 110, 170, 200, 140],
    31: [140, 170, 200, 710, 110],
    36: [110],
    41: [820, 281, 283, 285, 287, 290, 210, 610, 310, 410, 570, 360, 250, 197, 199, 195, 135, 131, 133, 113, 117, 111, 115, 390, 270, 273, 271, 550, 173, 171, 630, 830, 730, 670, 800, 370, 460, 463, 465, 461, 430, 150, 500, 480, 220, 810, 650, 450, 590],
    42: [150, 820, 170, 230, 210, 800, 830, 750, 130, 810, 770, 780, 110, 190, 760, 720, 790, 730],
    43: [760, 800, 720, 740, 730, 770, 150, 745, 750, 710, 111, 112, 114, 113, 130],
    44: [250, 150, 710, 230, 830, 270, 180, 760, 210, 770, 200, 730, 810, 130, 131, 133, 790, 825, 800],
    45: [790, 130, 210, 190, 730, 800, 770, 710, 140, 750, 740, 113, 111, 180, 720],
    46: [810, 770, 720, 230, 730, 170, 710, 110, 840, 780, 150, 910, 130, 870, 830, 890, 880, 800, 900, 860, 820, 790],
    47: [290, 130, 830, 190, 720, 150, 280, 920, 250, 840, 170, 770, 760, 210, 230, 900, 940, 930, 730, 820, 750, 850, 111, 113],
    48: [310, 880, 820, 250, 840, 160, 270, 240, 860, 332, 330, 720, 170, 190, 740, 110, 125, 127, 123, 121, 129, 220, 850, 730, 870, 890],
    50: [130, 110]
}

const SQL_TEMPLATE = (r, year) => `
                INSERT INTO WALK_ALERT
                    (ID, ADDRESS, OCCXRRNC_CNT,LATITUDE, LONGITUDE, YEAR)
                    VALUES('${r.afos_fid}', '${r.spot_nm}', '${r.occrrnc_cnt}', '${r.la_crd}', '${r.lo_crd}', '${year}')
                        ON CONFLICT(ID) 
                        DO UPDATE SET
                            ADDRESS = EXCLUDED.ADDRESS,
                            OCCXRRNC_CNT = EXCLUDED.OCCXRRNC_CNT,
                            LATITUDE = EXCLUDED.LATITUDE,
                            LONGITUDE = EXCLUDED.LONGITUDE               
            `
async function main() {
    const sidoList = Object.keys(sido_gugun_map_with_codes)
    let loop_len = sidoList.length;
    let startTime = new Date();
    for (let y = 2021; y < 2024; y++) {
        for (let s = 0; s < sidoList.length; s++) {
            progressBar.progressBar(s, loop_len, startTime);
            const gubunList = sido_gugun_map_with_codes[sidoList[s]];
            for (let g = 0; g < gubunList.length; g++) {
                const resXml = await fetch(`https://opendata.koroad.or.kr/data/rest/frequentzone/pedstrians?authKey=${process.env.WALK_TOKEN}&searchYearCd=${y}&siDo=${sidoList[s]}&guGun=${gubunList[g]}`)
                    .then(res => res.text());

                const jObj = parser.parse(resXml);

                if (jObj.response.body.totalCount == 0) continue;

                if (Array.isArray(jObj.response.body.items.item)) {
                    const sqlList = jObj.response.body.items.item.map(r => SQL_TEMPLATE(r, y));

                    for (let i = 0; i < sqlList.length; i++) {
                        // console.log(sqlList[i]);
                        await pgExecute.unsafe(`${sqlList[i]}`);
                    }
                } else {
                    if (jObj.response.body.items.item != '')
                        await pgExecute.unsafe(SQL_TEMPLATE(jObj.response.body.items.item, y));
                }
            }
        }
    }

    pgExecute.end();


}

main();
const express = require("express");
const path = require("path");

const pgExecute = require("./db");
const app = express();

const PORT = process.env.PORT || 3000;

app.use(express.json());

// EJS 템플릿 엔진 설정
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "public"));

// 기본 path를 /public으로 설정(css, javascript 등의 파일 사용을 위해)
// app.use(express.static(__dirname + '/public'));

const authMiddleware = (req, res, next) => {
  const authKey = req.header("authKey");
  if (authKey === process.env.AUTH_KEY) {
    next(); // Authorized
  } else {
    res.status(403).send("Forbidden: Invalid authKey");
  }
};

app.get("/map", (req, res) => {
  res.render("map", { authKey: process.env.AUTH_KEY });
});


app.get("/generator-driving", (req, res) => {
  res.render("generator-driving", { authKey: process.env.AUTH_KEY });
});


function getParameter(req) {
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);
  const radius = parseFloat(req.query.radius);

  return {
    lat,
    lon,
    radius,
  };
}
app.get("/traffic-alert", authMiddleware, async (req, res) => {
  const { lat, lon, radius } = getParameter(req);
  if (!lat || !lon) {
    return res.status(400).send("Bad Request: Missing or invalid lat/lon");
  }

  const nearbyEvent = await pgExecute`
       SELECT
          ST_DISTANCE(
              geography(ST_SetSRID(ST_Point(LONGITUDE, LATITUDE), 4326)),
              geography(ST_SetSRID(ST_Point(${lon}, ${lat}), 4326))
          )::double precision AS distance,
          *
      FROM traffic_alert
      WHERE
          ST_DWithin(
              geography(ST_SetSRID(ST_Point(LONGITUDE, LATITUDE), 4326)),
              geography(ST_SetSRID(ST_Point(${lon}, ${lat}), 4326)),
              ${isNaN(radius) ? parseFloat(process.env.TRAFFIC_RADIUS || '500') : radius}
          )
          AND START_DTM <= NOW()
          AND END_DTM >= NOW()
      ORDER BY distance;


        `;

  if (nearbyEvent.length > 0) {
    res.json(nearbyEvent);
  } else {
    res.status(204).send("No Content: No accidents nearby");
  }
});

app.get("/user-path", authMiddleware, async (req, res) => {
  try {
    const {userId, movementId}  = req.query;

    // userId가 존재하는지 검증
    if (!userId) {
      return res.status(400).json({ error: "Invalid userId" });
    }

    // 템플릿 리터럴 태그로 변경
    const nearbyEvent = await pgExecute`
      SELECT 
        UPP.USER_ID,
        ST_AsText(UPP.POINT) AS USER_LOCATION,
        UPP.TIME AS USER_TIME,
        UPP.SPEED AS USER_SPEED
      FROM 
        USER_PATH_POINTS UPP
      WHERE 
        UPP.USER_ID = ${userId}::VARCHAR
        AND UPP.MOVEMENT_ID = ${movementId}::VARCHAR
      ORDER BY UPP.sequence
    `;

    if (nearbyEvent.length > 0) {
      res.json(nearbyEvent);
    } else {
      res.status(204).send("No Content: No user path");
    }
  } catch (error) {
    console.error("Error fetching user path:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});



app.get("/user-path-traffic-alert", authMiddleware, async (req, res) => {
  try {
    const {userId, movementId}  = req.query;

    // userId가 존재하는지 검증
    if (!userId) {
      return res.status(400).json({ error: "Invalid userId" });
    }

    // 템플릿 리터럴 태그로 변경
    const nearbyEvent = await pgExecute`
      SELECT DISTINCT ON (TA.ID)
          TA.ID,
          TA.ADDRESS,
          TA.TITLE,
          TA.TYPE_CD,
          TA.SUB_CD,
          TA.LATITUDE,
          TA.LONGITUDE,
          TA.START_DTM,
          TA.END_DTM
      FROM 
          TRAFFIC_ALERT TA
      LEFT JOIN 
          USER_PATH_POINTS UPP
      ON 
          ST_DWithin(UPP.POINT, ST_SetSRID(ST_Point(TA.LONGITUDE, TA.LATITUDE), 4326), 1000/111320.0)
      WHERE
          UPP.USER_ID = ${userId}::VARCHAR
          AND UPP.MOVEMENT_ID = ${movementId}::VARCHAR
          AND TA.START_DTM <= NOW()
          AND TA.END_DTM >= NOW()
      ORDER BY 
          TA.ID
    `;

    if (nearbyEvent.length > 0) {
      res.json(nearbyEvent);
    } else {
      res.status(204).send("No Content: No user path");
    }
  } catch (error) {
    console.error("Error fetching user path:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});




app.get("/user-path-walk-alert", authMiddleware, async (req, res) => {
  try {
    const {userId, movementId}  = req.query;

    // userId가 존재하는지 검증
    if (!userId) {
      return res.status(400).json({ error: "Invalid userId" });
    }

    // 템플릿 리터럴 태그로 변경
    const nearbyEvent = await pgExecute`
      SELECT DISTINCT ON (WA.ID)
          WA.ID,
          WA.ADDRESS ,
          WA.YEAR ,
          WA.OCCXRRNC_CNT ,
          WA.LATITUDE ,
          WA.LONGITUDE ,
          WA.REG_DTM 
      FROM 
          WALK_ALERT WA
      LEFT JOIN 
          USER_PATH_POINTS UPP
      ON 
          ST_DWithin(
              UPP.POINT, 
              ST_SetSRID(ST_Point(WA.LONGITUDE, WA.LATITUDE), 4326), 
              500 / 111320.0 -- 500m 거리 내의 WALK_ALERT
          )
      WHERE 
          UPP.USER_ID = ${userId}::VARCHAR
          AND UPP.MOVEMENT_ID = ${movementId}::VARCHAR
      ORDER BY 
          WA.ID
    `;

    if (nearbyEvent.length > 0) {
      res.json(nearbyEvent);
    } else {
      res.status(204).send("No Content: No user path");
    }
  } catch (error) {
    console.error("Error fetching user path:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/generator-driving", authMiddleware, async(req, res) => {
  try {
    const { startLocation, endLocation, userId, movementId } = req.body;

    if (!startLocation || !endLocation || !userId || !movementId) {
      return res.status(400).json({ message: '필수 데이터가 없습니다.' });
    }

    const osrmUrl = `http://router.project-osrm.org/route/v1/driving/${startLocation.lng},${startLocation.lat};${endLocation.lng},${endLocation.lat}?overview=full&geometries=geojson`;

    const response = await fetch(osrmUrl);
    const data = await response.json();

    const coordinates = data.routes[0].geometry.coordinates;

    const startTime = new Date();
    const timeInterval = 5;  // 5초 간격
    const minSpeedKmh = 30;  // 최소 속도 30km/h
    const maxSpeedKmh = 80;  // 최대 속도 80km/h

    await pgExecute`INSERT INTO USER_PATH_INFO (USER_ID, MOVEMENT_ID, START_POINT, END_POINT, START_DTM, END_DTM, MOVE_KM) VALUES (${userId}, ${movementId}, ST_SetSRID(ST_Point(${startLocation.lng},${startLocation.lat}), 4326),ST_SetSRID(ST_Point(${startLocation.lng},${startLocation.lat}), 4326), ${new Date(startTime.getTime()  + 1000)}, ${new Date(startTime.getTime() + data.routes[0].duration * 1000)}, ${data.routes[0].distance / 1000})`;

    const promises = coordinates.map(async (coordinate, i) => {
      const currentTime = new Date(startTime.getTime() + i * timeInterval * 1000);
      const speedKmh = Math.floor(Math.random() * (maxSpeedKmh - minSpeedKmh + 1)) + minSpeedKmh;  // 랜덤한 속도
      const speedMps = speedKmh * 1000 / 3600;  // 초당 이동 거리 (미터)
      
      await pgExecute`INSERT INTO USER_PATH_POINTS (USER_ID, MOVEMENT_ID, POINT, TIME, SPEED, SEQUENCE) VALUES (${userId}, ${movementId}, ST_SetSRID(ST_Point(${coordinate[0]}, ${coordinate[1]}), 4326), ${currentTime.toISOString().replace('T', ' ').replace('Z', '')}, ${speedKmh}, ${i + 1})`;
    });
    
    await Promise.all(promises);
    return res.json({ status: "OK" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: "FAIL", message: '서버 오류' });
  }
})

app.get("/walk-alert", authMiddleware, async (req, res) => {
  const { lat, lon, radius } = getParameter(req);

  if (!lat || !lon) {
    return res.status(400).send("Bad Request: Missing or invalid lat/lon");
  }

  const nearbyEvent = await pgExecute`
                WITH filtered_walk_alert AS (
                  SELECT 
                      WA.ID, WA.ADDRESS, WA.LATITUDE, WA.LONGITUDE, WA.OCCXRRNC_CNT, WA.YEAR, WA.REG_DTM
                  FROM 
                      walk_alert WA
                  WHERE
                      ST_DWithin(
                          geography(ST_SetSRID(ST_Point(WA.LONGITUDE, WA.LATITUDE), 4326)),
                          geography(ST_SetSRID(ST_Point(${lon}, ${lat}), 4326)),
                          ${isNaN(radius) ? parseFloat(process.env.WALK_RADIUS || '50') : radius}
                      )
              )
              SELECT 
                  ST_DISTANCE(
                      geography(ST_SetSRID(ST_Point(WA.LONGITUDE, WA.LATITUDE), 4326)),
                      geography(ST_SetSRID(ST_Point(${lon}, ${lat}), 4326))
                  )::double precision AS distance,
                  WA.ID, WA.ADDRESS, WA.LATITUDE, WA.LONGITUDE, WA.OCCXRRNC_CNT, WA.YEAR, WA.REG_DTM
              FROM 
                  filtered_walk_alert WA
              ORDER BY 
                  distance;

    `;

  if (nearbyEvent.length > 0) {
    res.json(nearbyEvent);
  } else {
    res.status(204).send("No Content: No accidents nearby");
  }
});

app.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}`);
});

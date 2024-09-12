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

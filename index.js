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
            )::double precision as distance,
            *
        FROM traffic_alert
        WHERE
        ST_DWithin(
                geography(ST_SetSRID(ST_Point(LONGITUDE, LATITUDE), 4326)),
                geography(ST_SetSRID(ST_Point(${lon}, ${lat}), 4326)),
            -- 500 -- 500M
            ${isNaN(radius) ? parseFloat(process.env.TRAFFIC_RADIUS) : radius}
            )
            AND START_DTM <= NOW()
            AND END_DTM >= NOW()
        order by distance   
  `;

  if (nearbyEvent.length > 0) {
    res.json(nearbyEvent);
  } else {
    res.status(204).send("No Content: No accidents nearby");
  }
});

app.get("/walk-alert", authMiddleware, async (req, res) => {
  const { lat, lon, radius } = getParameter(req);

  if (!lat || !lon) {
    return res.status(400).send("Bad Request: Missing or invalid lat/lon");
  }

  const nearbyEvent = await pgExecute`
          SELECT    
              ST_DISTANCE(
              geography(ST_SetSRID(ST_Point(LONGITUDE, LATITUDE), 4326)),
              geography(ST_SetSRID(ST_Point(${lon}, ${lat}), 4326))
              )::double precision as distance,
              *
          FROM walk_alert
          WHERE
          ST_DWithin(
                  geography(ST_SetSRID(ST_Point(LONGITUDE, LATITUDE), 4326)),
                  geography(ST_SetSRID(ST_Point(${lon}, ${lat}), 4326)),
              -- 50 -- 50M
              ${isNaN(radius) ? parseFloat(process.env.WALK_RADIUS) : radius}
              )
          order by distance   
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

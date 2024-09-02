const express = require('express');
const  pgExecute = require('./db');
const app = express();

const PORT = process.env.PORT || 3000;

app.use(express.json());




const authMiddleware = (req, res, next) => {
  const authKey = req.header('authKey');
  if (authKey === process.env.AUTH_KEY) {
    next(); // Authorized
  } else {
    res.status(403).send('Forbidden: Invalid authKey');
  }
};

app.use(authMiddleware);

app.get('/traffic-alert', async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);

  if (!lat || !lon) {
    return res.status(400).send('Bad Request: Missing or invalid lat/lon');
  }


  const nearbyEvent = await pgExecute`
        SELECT    
            ST_DISTANCE(
            geography(ST_SetSRID(ST_Point("LONGITUDE", "LATITUDE"), 4326)),
            geography(ST_SetSRID(ST_Point(${lon}, ${lat}), 4326))
            )::double precision as distance,
            *
        FROM public.traffic_alert
        WHERE
        ST_DWithin(
                geography(ST_SetSRID(ST_Point("LONGITUDE", "LATITUDE"), 4326)),
                geography(ST_SetSRID(ST_Point(${lon}, ${lat}), 4326)),
            500 -- 500M
            )
            AND "START_DTM" <= NOW()
            AND "END_DTM" >= NOW()
        order by distance   
  `;

  if (nearbyEvent.length > 0) {
    res.json(nearbyEvent);
  } else {
    res.status(204).send('No Content: No accidents nearby');
  }
});

app.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}`)
})
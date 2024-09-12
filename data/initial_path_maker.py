import requests
import datetime

# 인천 시청 좌표와 서울 강남구 서초 빌딩 좌표
start_coords = (37.456256, 126.705206)  # 인천 시청
end_coords = (37.504546, 127.004641)    # 서울 강남구 서초 빌딩

# OSRM 경로 요청 URL
osrm_url = f"http://router.project-osrm.org/route/v1/driving/{start_coords[1]},{start_coords[0]};{end_coords[1]},{end_coords[0]}?overview=full&geometries=geojson"

# OSRM 경로 요청
response = requests.get(osrm_url)
data = response.json()

# 경로 데이터 (geojson 형식)
coordinates = data['routes'][0]['geometry']['coordinates']

# 5초마다 좌표를 샘플링 (시작 시간 설정)
start_time = datetime.datetime.now()
time_interval = 5  # 5초 간격
speed_kmh = 80  # 평균 속도 80km/h
speed_mps = speed_kmh * 1000 / 3600  # 초당 이동 거리 (미터)

# SQL INSERT 쿼리 생성
user_id = 'user_123'
movement_id = 'move_001'
sql_inserts = []

for i, (lon, lat) in enumerate(coordinates):
    current_time = start_time + datetime.timedelta(seconds=i * time_interval)
    
    sql = f"""  INSERT INTO USER_PATH_POINTS (USER_ID, MOVEMENT_ID, POINT, TIME, SPEED, SEQUENCE)   VALUES (      '{user_id}',       '{movement_id}',       ST_SetSRID(ST_Point({lon}, {lat}), 4326),       '{current_time.strftime('%Y-%m-%d %H:%M:%S')}',      {speed_kmh},       {i + 1}  );   """
    sql_inserts.append(sql)

# 쿼리 출력
print(sql_inserts)
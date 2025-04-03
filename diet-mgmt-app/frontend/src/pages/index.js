// frontend/src/pages/index.tsx
import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import styles from '../styles/Home.module.css';

export default function Home() {
  return (
    <div className={styles.container}>
      <Head>
        <title>다이어트 관리 앱</title>
        <meta name="description" content="다이어트 관리 및 식단 계획을 위한 앱" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <h1 className={styles.title}>
          다이어트 관리 앱에 오신 것을 환영합니다!
        </h1>

        <p className={styles.description}>
          식단 관리, 영양 정보 추적, 그리고 주변 식당 찾기를 시작하세요
        </p>

        <div className={styles.grid}>
          <Link href="/dashboard" className={styles.card}>
            <h2>대시보드 &rarr;</h2>
            <p>내 식단 계획과 영양 정보를 확인하세요.</p>
          </Link>

          <Link href="/meals" className={styles.card}>
            <h2>식단 관리 &rarr;</h2>
            <p>나만의 식단을 계획하고 관리하세요.</p>
          </Link>

          <Link href="/map" className={styles.card}>
            <h2>주변 식당 찾기 &rarr;</h2>
            <p>내 식단에 맞는 주변 식당을 찾아보세요.</p>
          </Link>

          <Link href="/profile" className={styles.card}>
            <h2>내 프로필 &rarr;</h2>
            <p>알레르기 정보와 식이 선호도를 설정하세요.</p>
          </Link>
        </div>
      </main>
    </div>
  );
}

// frontend/src/pages/map.tsx
import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import styles from '../styles/Map.module.css';

export default function Map() {
  const mapRef = useRef(null);
  const [location, setLocation] = useState({ lat: 37.5665, lng: 126.9780 }); // 서울 기본 위치
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('restaurant'); // 기본 필터

  useEffect(() => {
    // 사용자 위치 가져오기
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.error('위치 정보를 가져올 수 없습니다:', error);
        }
      );
    }
  }, []);

  useEffect(() => {
    // Leaflet 지도 초기화
    if (!mapRef.current) return;

    // Leaflet 지도 API 관련 코드
    const L = window.L;
    const map = L.map(mapRef.current).setView([location.lat, location.lng], 15);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // 주변 식당 정보 가져오기
    fetch(`/api/places?lat=${location.lat}&lng=${location.lng}&type=${filter}`)
      .then(res => res.json())
      .then(data => {
        setPlaces(data);
        setLoading(false);
        
        // 식당 마커 표시
        data.forEach(place => {
          const marker = L.marker([place.lat, place.lng]).addTo(map);
          marker.bindPopup(`
            <strong>${place.name}</strong><br>
            ${place.address}<br>
            <a href="/place/${place.id}">자세히 보기</a>
          `);
        });
      })
      .catch(err => {
        console.error('데이터를 가져오는 중 오류 발생:', err);
        setLoading(false);
      });

    return () => {
      map.remove();
    };
  }, [location, filter]);

  return (
    <div className={styles.container}>
      <Head>
        <title>주변 식당 찾기 | 다이어트 관리 앱</title>
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.7.1/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.7.1/dist/leaflet.js"></script>
      </Head>

      <main className={styles.main}>
        <h1 className={styles.title}>주변 식당 찾기</h1>

        <div className={styles.filterContainer}>
          <select 
            value={filter} 
            onChange={(e) => setFilter(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="restaurant">식당</option>
            <option value="grocery">식료품점</option>
            <option value="health_food">건강식품점</option>
          </select>
        </div>

        <div id="map" ref={mapRef} className={styles.map}></div>

        {loading ? (
          <p>로딩 중...</p>
        ) : (
          <div className={styles.placesList}>
            <h2>검색 결과</h2>
            {places.length === 0 ? (
              <p>검색 결과가 없습니다.</p>
            ) : (
              <ul>
                {places.map(place => (
                  <li key={place.id}>
                    <h3>{place.name}</h3>
                    <p>{place.address}</p>
                    <p>{place.distance} km 떨어짐</p>
                    <Link href={`/place/${place.id}`}>
                      자세히 보기
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

// frontend/src/pages/dashboard.tsx
import { useState, useEffect } from 'react';
import Head from 'next/head';
import styles from '../styles/Dashboard.module.css';
import { Line } from 'react-chartjs-2';
import { Chart, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';

// Chart.js 등록
Chart.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

export default function Dashboard() {
  const [userData, setUserData] = useState(null);
  const [mealPlans, setMealPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 사용자 정보 가져오기
    Promise.all([
      fetch('/api/user').then(res => res.json()),
      fetch('/api/meals/plan').then(res => res.json())
    ])
      .then(([userData, mealPlansData]) => {
        setUserData(userData);
        setMealPlans(mealPlansData);
        setLoading(false);
      })
      .catch(err => {
        console.error('데이터를 가져오는 중 오류 발생:', err);
        setLoading(false);
      });
  }, []);

  // 차트 데이터 준비
  const chartData = {
    labels: ['1주차', '2주차', '3주차', '4주차'],
    datasets: [
      {
        label: '체중 (kg)',
        data: userData?.weightHistory || [75, 74, 72.5, 71],
        fill: false,
        backgroundColor: 'rgb(75, 192, 192)',
        borderColor: 'rgba(75, 192, 192, 0.2)',
      },
      {
        label: '칼로리 섭취량 (kcal)',
        data: userData?.calorieHistory || [2200, 2000, 1900, 1800],
        fill: false,
        backgroundColor: 'rgb(255, 99, 132)',
        borderColor: 'rgba(255, 99, 132, 0.2)',
      },
    ],
  };

  return (
    <div className={styles.container}>
      <Head>
        <title>내 대시보드 | 다이어트 관리 앱</title>
      </Head>

      <main className={styles.main}>
        <h1 className={styles.title}>내 대시보드</h1>

        {loading ? (
          <p>로딩 중...</p>
        ) : (
          <>
            <div className={styles.grid}>
              <div className={styles.card}>
                <h2>내 정보</h2>
                <p>이름: {userData?.name || '홍길동'}</p>
                <p>현재 체중: {userData?.currentWeight || '70'} kg</p>
                <p>목표 체중: {userData?.targetWeight || '65'} kg</p>
                <p>하루 목표 칼로리: {userData?.dailyCalorieGoal || '1800'} kcal</p>
              </div>

              <div className={styles.card}>
                <h2>진행 상황</h2>
                <div className={styles.chartContainer}>
                  <Line 
                    data={chartData} 
                    options={{
                      responsive: true,
                      plugins: {
                        legend: {
                          position: 'top',
                        },
                        title: {
                          display: true,
                          text: '4주 다이어트 진행 현황'
                        }
                      }
                    }} 
                  />
                </div>
              </div>
            </div>

            <div className={styles.mealPlans}>
              <h2>오늘의 식단</h2>
              {mealPlans.length === 0 ? (
                <p>계획된 식단이 없습니다.</p>
              ) : (
                <div className={styles.mealGrid}>
                  {mealPlans.map((meal, index) => (
                    <div key={index} className={styles.mealCard}>
                      <h3>{meal.type}</h3>
                      <p>{meal.name}</p>
                      <p>{meal.calories} kcal</p>
                      <p>단백질: {meal.protein}g | 탄수화물: {meal.carbs}g | 지방: {meal.fat}g</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

// frontend/src/pages/api/auth/[...nextauth].ts
import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

export default NextAuth({
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "이메일", type: "email" },
        password: { label: "비밀번호", type: "password" }
      },
      async authorize(credentials) {
        // 백엔드 API로 로그인 요청
        const res = await fetch(`${process.env.BACKEND_URL}/api/auth/login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: credentials.email,
            password: credentials.password,
          }),
        });

        const user = await res.json();

        if (res.ok && user) {
          return user;
        }
        return null;
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id;
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
});

// backend/src/index.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const mealRoutes = require('./routes/mealRoutes');
const placeRoutes = require('./routes/placeRoutes');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// 미들웨어
app.use(cors());
app.use(bodyParser.json());

// 데이터베이스 연결
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('MongoDB에 연결되었습니다'))
  .catch(err => console.error('MongoDB 연결 오류:', err));

// 라우트
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/meals', mealRoutes);
app.use('/api/places', placeRoutes);

// 기본 라우트
app.get('/', (req, res) => {
  res.send('다이어트 관리 앱 API가 실행 중입니다');
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`서버가 ${PORT} 포트에서 실행 중입니다`);
});

module.exports = app;

// backend/src/models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  currentWeight: {
    type: Number,
    required: true
  },
  targetWeight: {
    type: Number,
    required: true
  },
  height: {
    type: Number,
    required: true
  },
  dailyCalorieGoal: {
    type: Number,
    required: true
  },
  weightHistory: [{
    weight: Number,
    date: {
      type: Date,
      default: Date.now
    }
  }],
  calorieHistory: [{
    calories: Number,
    date: {
      type: Date,
      default: Date.now
    }
  }],
  allergies: [{
    type: String,
    trim: true
  }],
  dietPreferences: [{
    type: String,
    trim: true
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// 비밀번호 해싱
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// 비밀번호 검증 메서드
UserSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', UserSchema);

module.exports = User;

// backend/src/models/Meal.js
const mongoose = require('mongoose');

const MealSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  type: {
    type: String,
    required: true,
    enum: ['아침', '점심', '저녁', '간식']
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  ingredients: [{
    name: String,
    amount: String,
    calories: Number,
    protein: Number,
    carbs: Number,
    fat: Number
  }],
  calories: {
    type: Number,
    required: true
  },
  protein: {
    type: Number,
    required: true
  },
  carbs: {
    type: Number,
    required: true
  },
  fat: {
    type: Number,
    required: true
  },
  notes: {
    type: String,
    trim: true
  },
  imageUrl: {
    type: String,
    trim: true
  }
});

const Meal = mongoose.model('Meal', MealSchema);

module.exports = Meal;

// backend/src/routes/authRoutes.js
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// 사용자 등록
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, currentWeight, targetWeight, height } = req.body;

    // 이메일 중복 확인
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: '이미 등록된 이메일입니다' });
    }

    // BMR(기초 대사량) 계산 (해리스-베네딕트 공식 사용)
    // 남성: BMR = 88.362 + (13.397 × 체중(kg)) + (4.799 × 키(cm)) - (5.677 × 나이)
    // 여성: BMR = 447.593 + (9.247 × 체중(kg)) + (3.098 × 키(cm)) - (4.330 × 나이)
    // 여기서는 간단히 30세 남성으로 가정
    const bmr = 88.362 + (13.397 * currentWeight) + (4.799 * height) - (5.677 * 30);
    
    // 체중 감량을 위한 칼로리 목표 (BMR의 약 15% 감소)
    const dailyCalorieGoal = Math.round(bmr * 0.85);

    // 새 사용자 생성
    const user = new User({
      name,
      email,
      password,
      currentWeight,
      targetWeight,
      height,
      dailyCalorieGoal,
      weightHistory: [{ weight: currentWeight }],
      calorieHistory: []
    });

    await user.save();

    // JWT 토큰 생성
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        currentWeight: user.currentWeight,
        targetWeight: user.targetWeight,
        dailyCalorieGoal: user.dailyCalorieGoal
      }
    });
  } catch (error) {
    console.error('등록 오류:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다' });
  }
});

// 로그인
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // 사용자 찾기
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: '이메일 또는 비밀번호가 올바르지 않습니다' });
    }

    // 비밀번호 확인
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: '이메일 또는 비밀번호가 올바르지 않습니다' });
    }

    // JWT 토큰 생성
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        currentWeight: user.currentWeight,
        targetWeight: user.targetWeight,
        dailyCalorieGoal: user.dailyCalorieGoal
      }
    });
  } catch (error) {
    console.error('로그인 오류:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다' });
  }
});

// 사용자 정보 가져오기
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다' });
    }
    res.json(user);
  } catch (error) {
    console.error('사용자 정보 오류:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다' });
  }
});

module.exports = router;

// backend/src/routes/mealRoutes.js
const express = require('express');
const Meal = require('../models/Meal');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// 식사 계획 생성
router.post('/plan', auth, async (req, res) => {
  try {
    const { date, type, name, ingredients, calories, protein, carbs, fat, notes, imageUrl } = req.body;

    const newMeal = new Meal({
      user: req.user.userId,
      date: date || new Date(),
      type,
      name,
      ingredients,
      calories,
      protein,
      carbs,
      fat,
      notes,
      imageUrl
    });

    await newMeal.save();

    // 사용자의 칼로리 기록 업데이트
    await User.findByIdAndUpdate(
      req.user.userId,
      { $push: { calorieHistory: { calories, date: date || new Date() } } }
    );

    res.status(201).json(newMeal);
  } catch (error) {
    console.error('식사 계획 생성 오류:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다' });
  }
});

// 사용자의 식사 계획 가져오기
router.get('/plan', auth, async (req, res) => {
  try {
    const { date } = req.query;
    const query = { user: req.user.userId };
    
    if (date) {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      
      query.date = { $gte: startDate, $lte: endDate };
    }

    const meals = await Meal.find(query).sort({ date: 1 });
    res.json(meals);
  } catch (error) {
    console.error('식사 계획 조회 오류:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다' });
  }
});

// 식사 계획 업데이트
router.put('/plan/:id', auth, async (req, res) => {
  try {
    const { date, type, name, ingredients, calories, protein, carbs, fat, notes, imageUrl } = req.body;

    const meal = await Meal.findById(req.params.id);
    if (!meal) {
      return res.status(404).json({ message: '식사 계획을 찾을 수 없습니다' });
    }

    // 사용자 권한 확인
    if (meal.user.toString() !== req.user.userId) {
      return res.status(403).json({ message: '이 작업에 대한 권한이 없습니다' });
    }

    meal.date = date || meal.date;
    meal.type = type || meal.type;
    meal.name = name || meal.name;
    meal.ingredients = ingredients || meal.ingredients;
    meal.calories = calories || meal.calories;
    meal.protein = protein || meal.protein;
    meal.carbs = carbs || meal.carbs;
    meal.fat = fat || meal.fat;
    meal.notes = notes || meal.notes;
    meal.imageUrl = imageUrl || meal.imageUrl;

    await meal.save();
    res.json(meal);
  } catch (error) {
    console.error('식사 계획 업데이트 오류:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다' });
  }
});

// 식사 계획 삭제
router.delete('/plan/:id', auth, async (req, res) => {
  try {
    const meal = await Meal.findById(req.params.id);
    if (!meal) {
      return res.status(404).json({ message: '식사 계획을 찾을 수 없습니다' });
    }

    // 사용자 권한 확인
    if (meal.user.toString() !== req.user.userId) {
      return res.status(403).json({ message: '이 작업에 대한 권한이 없습니다' });
    }

    await meal.remove();
    res.json({ message: '식사 계획이 삭제되었습니다' });
  } catch (error) {
    console.error('식사 계획 삭제 오류:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다' });
  }
});

module.exports = router;

// backend/src/routes/placeRoutes.js
const express = require('express');
const fetch = require('node-fetch');
const router = express.Router();
const auth = require('../middleware/auth');

// 거리 계산 함수 (하버사인 공식)
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // 지구 반경 (km)
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c; // 킬로미터 단위 거리
  return distance;
}

// 주변 장소 검색 (OpenStreetMap Nominatim API 사용)
router.get('/', async (req, res) => {
  try {
    const { lat, lng, type, radius = 2 } = req.query; // 기본 반경 2km

    // Nominatim API로 주변 장소 검색
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?` +
      `format=json&q=${type}&limit=10&lat=${lat}&lon=${lng}&addressdetails=1`
    );
    
    const data = await response.json();
    
    // 결과 필터링 및 가공
    const places = data
      .filter(place => {
        const distance = getDistance(
          lat, 
          lng, 
          place.lat, 
          place.lon
        );
        return distance <= radius;
      })
      .map(place => {
	const distance = getDistance(
          lat, 
          lng, 
          place.lat, 
          place.lon
        );
        return distance <= radius;
      })
      .map(place => {
        const distance = getDistance(
          lat, 
          lng, 
          place.lat, 
          place.lon
        );
        
        return {
          id: place.place_id,
          name: place.display_name.split(',')[0],
          lat: place.lat,
          lng: place.lon,
          address: place.display_name,
          type: place.type,
          distance: parseFloat(distance.toFixed(2))
        };
      })
      .sort((a, b) => a.distance - b.distance);

    res.json(places);
  } catch (error) {
    console.error('장소 검색 오류:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다' });
  }
});

// 장소 상세 정보
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Nominatim API로 장소 상세 정보 검색
    const response = await fetch(
      `https://nominatim.openstreetmap.org/details?place_id=${id}&format=json`
    );
    
    const data = await response.json();
    
    if (!data) {
      return res.status(404).json({ message: '장소를 찾을 수 없습니다' });
    }
    
    const placeDetails = {
      id: data.place_id,
      name: data.localname || data.name,
      address: data.address,
      lat: data.centroid.coordinates[1],
      lng: data.centroid.coordinates[0],
      type: data.category,
      amenities: data.extratags || {},
      openingHours: data.extratags?.opening_hours || '정보 없음'
    };
    
    res.json(placeDetails);
  } catch (error) {
    console.error('장소 상세 정보 오류:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다' });
  }
});

module.exports = router;

// backend/src/middleware/auth.js
const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  try {
    // 헤더에서 토큰 가져오기
    const token = req.header('x-auth-token');
    
    // 토큰이 없는 경우
    if (!token) {
      return res.status(401).json({ message: '인증 토큰이 없습니다. 인증이 거부되었습니다.' });
    }
    
    // 토큰 검증
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // 요청에 사용자 정보 추가
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: '유효하지 않은 토큰입니다' });
  }
};

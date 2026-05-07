const DISEASE_ADVICE = {
  'apple_scab': { hi: 'Apple Scab', remedy: 'Fungicide spray karo (Captan/Sulfur).', severity: 'medium' },
  'apple_black_rot': { hi: 'Apple Black Rot', remedy: 'Pruning karo aur fungicide lagao.', severity: 'high' },
  'cedar_apple_rust': { hi: 'Cedar Apple Rust', remedy: 'Infected parts hatao aur fungicide spray karo.', severity: 'medium' },
  'cherry_powdery_mildew': { hi: 'Cherry Powdery Mildew', remedy: 'Sulfur-based spray use karo.', severity: 'medium' },
  'corn_gray_leaf_spot': { hi: 'Corn Gray Leaf Spot', remedy: 'Crop rotation aur fungicide use karo.', severity: 'medium' },
  'corn_common_rust': { hi: 'Corn Common Rust', remedy: 'Resistant varieties use karo.', severity: 'low' },
  'corn_northern_leaf_blight': { hi: 'Corn Northern Leaf Blight', remedy: 'Resistant hybrids lagao.', severity: 'medium' },
  'grape_black_rot': { hi: 'Grape Black Rot', remedy: 'Mancozeb fungicide spray karo.', severity: 'high' },
  'grape_esca': { hi: 'Grape Esca (Black Measles)', remedy: 'Trunk surgery aur protection spray.', severity: 'high' },
  'grape_leaf_blight': { hi: 'Grape Leaf Blight', remedy: 'Fungicide treatment karo.', severity: 'medium' },
  'orange_haunglongbing': { hi: 'Citrus Greening', remedy: 'Infected tree hatao aur psyllids control karo.', severity: 'high' },
  'peach_bacterial_spot': { hi: 'Peach Bacterial Spot', remedy: 'Copper spray use karo.', severity: 'medium' },
  'pepper_bell_bacterial_spot': { hi: 'Pepper Bacterial Spot', remedy: 'Copper-based bactericides spray karo.', severity: 'medium' },
  'potato_early_blight': { hi: 'Potato Early Blight', remedy: 'Chlorothalonil fungicide use karo.', severity: 'medium' },
  'potato_late_blight': { hi: 'Potato Late Blight', remedy: 'Metalaxyl-M ya copper spray karo.', severity: 'high' },
  'squash_powdery_mildew': { hi: 'Squash Powdery Mildew', remedy: 'Fungicide ya neem oil use karo.', severity: 'medium' },
  'strawberry_leaf_scorch': { hi: 'Strawberry Leaf Scorch', remedy: 'Fungicide aur field sanitation.', severity: 'medium' },
  'tomato_bacterial_spot': { hi: 'Tomato Bacterial Spot', remedy: 'Copper spray aur sanitation.', severity: 'medium' },
  'tomato_early_blight': { hi: 'Tomato Early Blight', remedy: 'Mancozeb fungicide spray karo.', severity: 'medium' },
  'tomato_late_blight': { hi: 'Tomato Late Blight', remedy: 'Chlorothalonil ya copper fungicide use karo.', severity: 'high' },
  'tomato_leaf_mold': { hi: 'Tomato Leaf Mold', remedy: 'Air circulation improve karo aur fungicide.', severity: 'medium' },
  'tomato_septoria_leaf_spot': { hi: 'Tomato Septoria', remedy: 'Fungicide aur mulching karo.', severity: 'medium' },
  'tomato_spider_mites': { hi: 'Tomato Spider Mites', remedy: 'Abamectin ya Neem oil spray karo.', severity: 'high' },
  'tomato_target_spot': { hi: 'Tomato Target Spot', remedy: 'Infected parts hatao aur fungicide.', severity: 'medium' },
  'tomato_yellow_leaf_curl': { hi: 'Tomato Yellow Leaf Curl', remedy: 'Whitefly control karo (Imidacloprid).', severity: 'high' },
  'tomato_mosaic_virus': { hi: 'Tomato Mosaic Virus', remedy: 'Infected plant hatao. Sanitation maintain karo.', severity: 'high' },
  'healthy': { hi: 'Fasal Swasth Hai', remedy: 'Koi bimari nahi mili. Regular checkup jari rakho.', severity: 'none' },
};

function getAdvice(label = '') {
  const normalizedLabel = label.toLowerCase()
    .replace(/ with /g, '_')
    .replace(/ /g, '_')
    .replace(/___/g, '_')
    .trim();
    
  for (const [disease, advice] of Object.entries(DISEASE_ADVICE)) {
    if (normalizedLabel.includes(disease)) {
      return { disease: advice.hi, remedy: advice.remedy, severity: advice.severity };
    }
  }
  return { disease: label.replace(/___/g, ' '), remedy: 'Nazdiki Krishi Vigyan Kendra (KVK) se sampark karo.', severity: 'unknown' };
}

module.exports = { DISEASE_ADVICE, getAdvice };

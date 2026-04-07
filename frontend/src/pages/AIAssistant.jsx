import { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import api from '../lib/api';
import { getMandiFloorForProduce } from '../lib/market';

const compressImage = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const MAX_SIZE = 1200;
        
        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob((blob) => {
          if (!blob) return reject(new Error('Canvas is empty'));
          const compressedFile = new File([blob], file.name, {
            type: 'image/jpeg',
            lastModified: Date.now()
          });
          resolve(compressedFile);
        }, 'image/jpeg', 0.8);
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

const ACTION_OPTIONS = [
  { value: 'register', label: 'Nayi fasal register karo' },
  { value: 'sell', label: 'Distributor ko becho' },
  { value: 'detect_disease', label: 'Fasal ki bimari pehchano (Photo)' }
];

const CROP_OPTIONS = [
  { value: 'Tamatar', label: 'Tamatar' },
  { value: 'Pyaaz', label: 'Pyaaz' },
  { value: 'Aalu', label: 'Aalu' },
  { value: 'Gehun', label: 'Gehun' },
  { value: 'Chawal', label: 'Chawal' },
  { value: 'OTHER', label: 'Anya fasal' }
];

const GRADE_OPTIONS = [
  { value: 'A', label: 'Grade A' },
  { value: 'B', label: 'Grade B' },
  { value: 'C', label: 'Grade C' }
];

export default function AIAssistant() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [messages, setMessages] = useState([]);
  const [currentPrompt, setCurrentPrompt] = useState(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [bootstrapData, setBootstrapData] = useState({ produces: [], distributors: [] });
  const [flow, setFlow] = useState(null);
  const [form, setForm] = useState({});
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [sellMarketFloor, setSellMarketFloor] = useState(null);
  const fileInputRef = useRef(null);

  const produceOptions = useMemo(
    () => bootstrapData.produces.map((produce) => ({
      value: produce._id,
      label: `${produce.cropType} • ${produce.quantity} kg • ${produce.origin}`,
      meta: `Grade ${produce.qualityGrade} • ₹${produce.farmPrice}/kg`
    })),
    [bootstrapData.produces]
  );

  const distributorOptions = useMemo(
    () => bootstrapData.distributors.map((distributor) => ({
      value: distributor.email,
      label: distributor.name,
      meta: distributor.location ? `${distributor.email} • ${distributor.location}` : distributor.email
    })),
    [bootstrapData.distributors]
  );

  const loadSellMarketFloor = async (produceId) => {
    const selectedProduce = bootstrapData.produces.find((produce) => produce._id === produceId);
    if (!selectedProduce) {
      setSellMarketFloor(null);
      return null;
    }

    try {
      const floorInfo = await getMandiFloorForProduce(selectedProduce);
      setSellMarketFloor(floorInfo);
      return floorInfo;
    } catch (err) {
      setSellMarketFloor(null);
      return null;
    }
  };

  useEffect(() => {
    const loadAssistant = async () => {
      try {
        const res = await api.get('/api/ai/farmer-assistant/bootstrap');
        setBootstrapData({
          produces: res.data.produces || [],
          distributors: res.data.distributors || []
        });

        pushAiMessage(res.data.greeting || `Namaste ${user.name}! Main aapka FarmTrace AI assistant hoon.`);
        askAction();
      } catch (err) {
        const message = err.response?.data?.message || 'AI assistant load nahi hua.';
        setError(message);
        pushAiMessage(`Namaste ${user.name}! Main aapki madad karunga. Neeche se kaam chuno.`);
        askAction();
      } finally {
        setLoading(false);
      }
    };

    loadAssistant();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pushAiMessage = (text, extra = {}) => {
    setMessages((prev) => [...prev, { id: `${Date.now()}-${prev.length}`, role: 'ai', text, ...extra }]);
  };

  const pushUserMessage = (text) => {
    setMessages((prev) => [...prev, { id: `${Date.now()}-${prev.length}`, role: 'user', text }]);
  };

  const setPrompt = (prompt) => {
    setCurrentPrompt(prompt);
    pushAiMessage(prompt.text, { options: prompt.options || null, promptKey: prompt.key });
  };

  const askAction = () => {
    setFlow(null);
    setForm({});
    setResult(null);
    setPrompt({
      key: 'action',
      type: 'option',
      text: 'Aaj aap kya karna chahte ho?',
      options: ACTION_OPTIONS
    });
  };

  const startRegisterFlow = () => {
    setFlow('register');
    setForm({ farmerName: user.name || '', cropType: '', origin: '', quantity: '', qualityGrade: '', farmPrice: '' });
    setPrompt({
      key: 'farmerNameChoice',
      type: 'option',
      text: `Kisan ka naam "${user.name}" use karun ya doosra naam bharna hai?`,
      options: [
        { value: 'use_saved_name', label: `${user.name || 'Saved name'} use karo` },
        { value: 'custom_name', label: 'Doosra naam bharna hai' }
      ]
    });
  };

  const startSellFlow = () => {
    if (!produceOptions.length) {
      pushAiMessage('Aapke paas abhi koi confirmed fasal nahi hai. Pehle nayi fasal register karo, phir distributor ko bech paoge.');
      askAction();
      return;
    }

    if (!distributorOptions.length) {
      pushAiMessage('Abhi koi distributor available nahi mila. Thodi der baad dobara try karo.');
      askAction();
      return;
    }

    setFlow('sell');
    setForm({ produceId: '', receiverEmail: '', pricePerKg: '', location: '', transferType: 'FARM_TO_DISTRIBUTOR' });
    setSellMarketFloor(null);
    setPrompt({
      key: 'produceId',
      type: 'option',
      text: 'Kaunsi registered fasal distributor ko bhejni hai?',
      options: produceOptions
    });
  };

  const startDiseaseDetectFlow = () => {
    setFlow('detect_disease');
    setPrompt({
      key: 'uploadImage',
      type: 'image',
      text: 'Fasal ki bimari pehchanne ke liye kharab patte (leaf) ki saaf photo upload karein.'
    });
  };

  const askNextRegisterPrompt = (nextForm) => {
    if (!nextForm.farmerName) {
      setPrompt({
        key: 'farmerName',
        type: 'text',
        text: 'Theek hai, kisan ka naam likho.'
      });
      return;
    }

    if (!nextForm.cropType) {
      setPrompt({
        key: 'cropType',
        type: 'option',
        text: 'Kaunsi fasal register karni hai?',
        options: CROP_OPTIONS
      });
      return;
    }

    if (nextForm.cropType === 'OTHER' && !nextForm.customCropType) {
      setPrompt({
        key: 'customCropType',
        type: 'text',
        text: 'Fasal ka naam likho.'
      });
      return;
    }

    if (!nextForm.origin) {
      setPrompt({
        key: 'origin',
        type: 'text',
        text: 'Fasal ka mool sthan likho. Jaise Nashik, Maharashtra.'
      });
      return;
    }

    if (!nextForm.quantity) {
      setPrompt({
        key: 'quantity',
        type: 'number',
        text: 'Kitna kg hai? Sirf number likho.'
      });
      return;
    }

    if (!nextForm.qualityGrade) {
      setPrompt({
        key: 'qualityGrade',
        type: 'option',
        text: 'Gunvatta grade chuno.',
        options: GRADE_OPTIONS
      });
      return;
    }

    if (!nextForm.farmPrice) {
      setPrompt({
        key: 'farmPrice',
        type: 'number',
        text: 'Farm price kitna hai per kg? Sirf number likho.'
      });
      return;
    }

    const cropLabel = nextForm.cropType === 'OTHER' ? nextForm.customCropType : nextForm.cropType;
    setPrompt({
      key: 'registerConfirm',
      type: 'option',
      text: `Ye details sahi hain?\nNaam: ${nextForm.farmerName}\nFasal: ${cropLabel}\nSthan: ${nextForm.origin}\nMaatra: ${nextForm.quantity} kg\nGrade: ${nextForm.qualityGrade}\nPrice: ₹${nextForm.farmPrice}/kg`,
      options: [
        { value: 'confirm_register', label: 'Haan, register karo' },
        { value: 'restart_register', label: 'Dobara bharo' }
      ]
    });
  };

  const askNextSellPrompt = (nextForm) => {
    if (!nextForm.produceId) {
      setPrompt({
        key: 'produceId',
        type: 'option',
        text: 'Kaunsi registered fasal distributor ko bhejni hai?',
        options: produceOptions
      });
      return;
    }

    if (!nextForm.receiverEmail) {
      setPrompt({
        key: 'receiverEmail',
        type: 'option',
        text: 'Kis distributor ko bechna hai?',
        options: distributorOptions
      });
      return;
    }

    if (!nextForm.pricePerKg) {
      setPrompt({
        key: 'pricePerKg',
        type: 'number',
        text: 'Distributor ko kitne rupaye per kg par bechna hai? Sirf number likho.'
      });
      return;
    }

    if (!nextForm.location) {
      const selectedDistributor = bootstrapData.distributors.find(
        (distributor) => distributor.email === nextForm.receiverEmail
      );
      const suggestedLocation = selectedDistributor?.location;

      setPrompt({
        key: 'location',
        type: suggestedLocation ? 'option_or_text' : 'text',
        text: suggestedLocation
          ? `Deal location kya rahegi?`
          : 'Deal location likho. Jaise Pune, Maharashtra.',
        options: suggestedLocation
          ? [
              { value: suggestedLocation, label: suggestedLocation },
              { value: 'custom_location', label: 'Doosri location likhni hai' }
            ]
          : null
      });
      return;
    }

    const selectedProduce = bootstrapData.produces.find((produce) => produce._id === nextForm.produceId);
    const selectedDistributor = bootstrapData.distributors.find(
      (distributor) => distributor.email === nextForm.receiverEmail
    );

    setPrompt({
      key: 'sellConfirm',
      type: 'option',
      text: `Ye transfer bhej du?\nFasal: ${selectedProduce?.cropType || '-'}\nMaatra: ${selectedProduce?.quantity || '-'} kg\nDistributor: ${selectedDistributor?.name || nextForm.receiverEmail}\nEmail: ${selectedDistributor?.email || nextForm.receiverEmail}\nPrice: ₹${nextForm.pricePerKg}/kg\nLocation: ${nextForm.location}`,
      options: [
        { value: 'confirm_sell', label: 'Haan, bhejo' },
        { value: 'restart_sell', label: 'Dobara bharo' }
      ]
    });
  };

  const handleOptionSelect = async (option) => {
    if (submitting || loading) return;

    pushUserMessage(option.label);

    if (currentPrompt?.key === 'action') {
      if (option.value === 'register') startRegisterFlow();
      if (option.value === 'sell') startSellFlow();
      if (option.value === 'detect_disease') startDiseaseDetectFlow();
      return;
    }

    if (flow === 'register') {
      await handleRegisterAnswer(option.value, option.label);
      return;
    }

    if (flow === 'sell') {
      await handleSellAnswer(option.value, option.label);
    }
  };

  const handleTypedSubmit = async () => {
    if (!input.trim() || submitting || loading || !currentPrompt) return;

    const answer = input.trim();
    setInput('');
    pushUserMessage(answer);

    if (currentPrompt.key === 'action') {
      const normalized = answer.toLowerCase();
      if (normalized.includes('register')) startRegisterFlow();
      else if (normalized.includes('bech') || normalized.includes('sell')) startSellFlow();
      else if (normalized.includes('bimari') || normalized.includes('disease') || normalized.includes('photo') || normalized.includes('pehchan')) startDiseaseDetectFlow();
      else pushAiMessage('Teen options mein se chuno: nayi fasal register karni hai, distributor ko bechna hai, ya bimari pehchanni hai?');
      return;
    }

    if (flow === 'register') {
      await handleRegisterAnswer(answer, answer);
      return;
    }

    if (flow === 'sell') {
      await handleSellAnswer(answer, answer);
    }
  };

  const handleRegisterAnswer = async (value) => {
    const nextForm = { ...form };

    if (currentPrompt.key === 'farmerNameChoice') {
      if (value === 'use_saved_name') nextForm.farmerName = user.name || '';
      if (value === 'custom_name') nextForm.farmerName = '';
      setForm(nextForm);
      askNextRegisterPrompt(nextForm);
      return;
    }

    if (currentPrompt.key === 'farmerName') {
      if (!value.trim()) {
        pushAiMessage('Naam khaali nahi chhod sakte. Dobara likho.');
        setPrompt(currentPrompt);
        return;
      }
      nextForm.farmerName = value.trim();
    }

    if (currentPrompt.key === 'cropType') {
      const selected = CROP_OPTIONS.find((item) => item.value === value || item.label.toLowerCase() === String(value).toLowerCase());
      if (!selected) {
        pushAiMessage('Crop option mein se ek chuno.');
        setPrompt({ ...currentPrompt });
        return;
      }
      nextForm.cropType = selected.value;
      if (selected.value !== 'OTHER') nextForm.customCropType = '';
    }

    if (currentPrompt.key === 'customCropType') {
      if (!value.trim()) {
        pushAiMessage('Fasal ka naam likho.');
        setPrompt(currentPrompt);
        return;
      }
      nextForm.customCropType = value.trim();
    }

    if (currentPrompt.key === 'origin') {
      if (!value.trim()) {
        pushAiMessage('Mool sthan likho.');
        setPrompt(currentPrompt);
        return;
      }
      nextForm.origin = value.trim();
    }

    if (currentPrompt.key === 'quantity') {
      const numericValue = Number(value);
      if (!Number.isFinite(numericValue) || numericValue <= 0) {
        pushAiMessage('Quantity ke liye valid number likho.');
        setPrompt(currentPrompt);
        return;
      }
      nextForm.quantity = numericValue;
    }

    if (currentPrompt.key === 'qualityGrade') {
      const selected = GRADE_OPTIONS.find((item) => item.value === value || item.label.toLowerCase() === String(value).toLowerCase());
      if (!selected) {
        pushAiMessage('Grade option mein se ek chuno.');
        setPrompt({ ...currentPrompt });
        return;
      }
      nextForm.qualityGrade = selected.value;
    }

    if (currentPrompt.key === 'farmPrice') {
      const numericValue = Number(value);
      if (!Number.isFinite(numericValue) || numericValue <= 0) {
        pushAiMessage('Price ke liye valid number likho.');
        setPrompt(currentPrompt);
        return;
      }
      nextForm.farmPrice = numericValue;
    }

    if (currentPrompt.key === 'registerConfirm') {
      if (value === 'restart_register') {
        pushAiMessage('Theek hai, register form dobara shuru karte hain.');
        startRegisterFlow();
        return;
      }

      if (value === 'confirm_register') {
        await submitRegister();
        return;
      }
    }

    setForm(nextForm);
    askNextRegisterPrompt(nextForm);
  };

  const handleSellAnswer = async (value) => {
    const nextForm = { ...form };

    if (currentPrompt.key === 'produceId') {
      const selected = produceOptions.find(
        (item) => item.value === value || item.label.toLowerCase() === String(value).toLowerCase()
      );
      if (!selected) {
        pushAiMessage('Apni listed fasal mein se ek chuno.');
        setPrompt({ ...currentPrompt });
        return;
      }
      nextForm.produceId = selected.value;
      const floorInfo = await loadSellMarketFloor(selected.value);
      if (!floorInfo?.floorPrice) {
        pushAiMessage(`${selected.label.split(' • ')[0]} ka mandi rate ya MSP abhi available nahi hai. Isliye ye fasal sell nahi ki ja sakti.`);
        startSellFlow();
        return;
      }
    }

    if (currentPrompt.key === 'receiverEmail') {
      const selected = distributorOptions.find(
        (item) => item.value === value || item.label.toLowerCase() === String(value).toLowerCase()
      );
      if (!selected) {
        pushAiMessage('Distributor list mein se ek chuno.');
        setPrompt({ ...currentPrompt });
        return;
      }
      nextForm.receiverEmail = selected.value;
    }

    if (currentPrompt.key === 'pricePerKg') {
      const numericValue = Number(value);
      if (!Number.isFinite(numericValue) || numericValue <= 0) {
        pushAiMessage('Price ke liye valid number likho.');
        setPrompt(currentPrompt);
        return;
      }
      const floorPrice = sellMarketFloor?.floorPrice ?? sellMarketFloor?.mandiPrice;
      if (floorPrice && numericValue < floorPrice) {
        pushAiMessage(`Price ${sellMarketFloor?.floorLabel || `₹${floorPrice.toFixed(2)}/kg`} se kam nahi ho sakta.`);
        setPrompt(currentPrompt);
        return;
      }
      nextForm.pricePerKg = numericValue;
    }

    if (currentPrompt.key === 'location') {
      if (!value.trim()) {
        pushAiMessage('Location likho.');
        setPrompt(currentPrompt);
        return;
      }
      nextForm.location = value.trim();
    }

    if (currentPrompt.key === 'sellConfirm') {
      if (value === 'restart_sell') {
        pushAiMessage('Theek hai, selling details dobara bharte hain.');
        startSellFlow();
        return;
      }

      if (value === 'confirm_sell') {
        await submitSell();
        return;
      }
    }

    if (currentPrompt.key === 'location' && value === 'custom_location') {
      setForm(nextForm);
      setPrompt({
        key: 'location',
        type: 'text',
        text: 'Doosri location likho. Jaise Pune, Maharashtra.'
      });
      return;
    }

    if (currentPrompt.key === 'location' && value !== 'custom_location' && currentPrompt.options) {
      nextForm.location = value;
    }

    setForm(nextForm);
    askNextSellPrompt(nextForm);
  };

  const submitRegister = async () => {
    setSubmitting(true);
    try {
      const cropType = form.cropType === 'OTHER' ? form.customCropType : form.cropType;
      const res = await api.post('/api/produce/register', {
        farmerName: form.farmerName || user.name,
        cropType,
        origin: form.origin,
        quantity: Number(form.quantity),
        qualityGrade: form.qualityGrade,
        farmPrice: Number(form.farmPrice)
      });

      const verifyUrl = `${window.location.origin}/verify/${res.data.produce._id}`;
      const qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: 240 });

      setResult({
        type: 'register',
        title: 'Fasal blockchain pe register ho gayi',
        text: `${cropType} ki entry save ho gayi. QR aur verification link neeche hai.`,
        qrDataUrl,
        verifyUrl
      });
      pushAiMessage(`Fasal register ho gayi. ${cropType} ab FarmTrace par verified entry ke saath dikh rahi hai.`);
      setCurrentPrompt(null);
    } catch (err) {
      pushAiMessage(err.response?.data?.message || 'Register karne mein dikkat aayi.');
    } finally {
      setSubmitting(false);
    }
  };

  const submitSell = async () => {
    setSubmitting(true);
    try {
      const floorPrice = sellMarketFloor?.floorPrice ?? sellMarketFloor?.mandiPrice;
      if (floorPrice && Number(form.pricePerKg) < floorPrice) {
        pushAiMessage(`Price ${sellMarketFloor?.floorLabel || `₹${floorPrice.toFixed(2)}/kg`} se kam nahi ho sakta.`);
        return;
      }

      const res = await api.post('/api/ai/confirm-transfer', {
        produceId: form.produceId,
        receiverEmail: form.receiverEmail,
        pricePerKg: Number(form.pricePerKg),
        location: form.location,
        transferType: 'FARM_TO_DISTRIBUTOR'
      });

      setResult({
        type: 'sell',
        title: 'Transfer request bhej di gayi',
        text: res.data.message
      });
      pushAiMessage(`Transfer request distributor ko bhej di gayi. Payment aane ke baad aage ka flow complete hoga.`);
      setCurrentPrompt(null);
    } catch (err) {
      pushAiMessage(err.response?.data?.message || 'Transfer request bhejne mein dikkat aayi.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      pushAiMessage('Kripya sirf JPG, PNG ya WEBP photo upload karein.');
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setMessages((prev) => [...prev, { id: `${Date.now()}-${prev.length}`, role: 'user', type: 'image', imageUrl: objectUrl }]);

    setSubmitting(true);
    pushAiMessage('Photo check ki jaa rahi hai, thoda intezaar karein...');

    try {
      let finalFile = file;
      if (file.size > 1024 * 1024) { // Compress if larger than 1MB
        try {
          finalFile = await compressImage(file);
        } catch (e) {
          console.error("Compression failed, using original file", e);
        }
      }

      const formData = new FormData();
      formData.append('image', finalFile);

      const res = await api.post('/api/ai/disease-detect', formData);

      const data = res.data.data;
      const remedyHtml = `
        <div style="font-family: inherit">
          <strong>Bimari:</strong> <span style="color: #8B0000; font-weight: bold">${data.disease}</span><br/>
          <strong>Gambhirta (Severity):</strong> ${data.severity}<br/><br/>
          <strong>Upay (Remedies):</strong><br/>
          ${data.remedies.map(r => `• ${r}`).join('<br/>')}<br/><br/>
          <strong>Bachaav (Preventions):</strong><br/>
          ${data.preventions.map(p => `• ${p}`).join('<br/>')}
        </div>
      `;

      pushAiMessage(null, { html: remedyHtml });
      setCurrentPrompt(null);
      setFlow(null);
      
      setTimeout(() => {
        pushAiMessage('Agar aap koi aur kaam karna chahte hain, toh kripya batayein.');
        askAction();
      }, 1500);

    } catch (err) {
      pushAiMessage(err.response?.data?.message || 'Bimari pehchanne mein dikkat aayi. Kripya baad mein try karein.');
    } finally {
      setSubmitting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const isNumericPrompt = currentPrompt?.type === 'number';
  const showTextInput = currentPrompt && !currentPrompt.options;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button onClick={() => navigate('/dashboard')} style={styles.backBtn}>
          ← Dashboard
        </button>
        <div>
          <h2 style={styles.title}>Farmer AI Assistant</h2>
          <p style={styles.subtitle}>Register ya distributor sale, dono chat se karo</p>
        </div>
      </div>

      <div style={styles.chatBox}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              ...styles.msgRow,
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start'
            }}
          >
            {msg.role === 'ai' && <div style={styles.aiAvatar}>AI</div>}
            <div
              style={{
                ...styles.bubble,
                background: msg.role === 'user' ? '#27500A' : 'white',
                color: msg.role === 'user' ? 'white' : '#24331d'
              }}
            >
              {msg.type === 'image' ? (
                <img src={msg.imageUrl} alt="Uploaded leaf" style={styles.uploadedImg} />
              ) : msg.html ? (
                <div style={styles.bubbleText} dangerouslySetInnerHTML={{ __html: msg.html }} />
              ) : (
                <p style={styles.bubbleText}>{msg.text}</p>
              )}
              {msg.options && currentPrompt?.key === msg.promptKey && (
                <div style={styles.optionList}>
                  {msg.options.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleOptionSelect(option)}
                      disabled={submitting || loading}
                      style={styles.optionBtn}
                    >
                      <span>{option.label}</span>
                      {option.meta && <small style={styles.optionMeta}>{option.meta}</small>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {msg.role === 'user' && (
              <div style={styles.userAvatar}>
                {(user.name || 'U').charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        ))}

        {(loading || submitting) && (
          <div style={{ ...styles.msgRow, justifyContent: 'flex-start' }}>
            <div style={styles.aiAvatar}>AI</div>
            <div style={styles.bubble}>
              <p style={styles.typingDots}>● ● ●</p>
            </div>
          </div>
        )}
      </div>

      {result && (
        <div style={styles.resultCard}>
          <h3 style={styles.resultTitle}>{result.title}</h3>
          <p style={styles.resultText}>{result.text}</p>
          {result.qrDataUrl && (
            <>
              <img src={result.qrDataUrl} alt="QR Code" style={styles.qrImage} />
              <p style={styles.verifyUrl}>{result.verifyUrl}</p>
            </>
          )}
          <div style={styles.resultActions}>
            <button onClick={() => navigate('/dashboard')} style={styles.primaryBtn}>
              Dashboard pe jao
            </button>
            <button
              onClick={() => {
                pushAiMessage('Naya kaam shuru karte hain.');
                askAction();
              }}
              style={styles.secondaryBtn}
            >
              Ek aur kaam karo
            </button>
          </div>
        </div>
      )}

      {!result && (
        <div style={styles.inputWrap}>
          {currentPrompt?.type === 'image' ? (
            <div style={styles.uploadRow}>
              <input 
                type="file" 
                accept="image/jpeg, image/png, image/webp" 
                onChange={handleImageUpload} 
                ref={fileInputRef} 
                style={{ display: 'none' }} 
                id="disease-img-upload" 
                disabled={submitting || loading} 
              />
              <label htmlFor="disease-img-upload" style={styles.uploadLabelBtn}>
                📸 Photo Upload Karein
              </label>
            </div>
          ) : showTextInput ? (
            <div style={styles.inputRow}>
              <input
                style={styles.input}
                type={isNumericPrompt ? 'number' : 'text'}
                placeholder={isNumericPrompt ? 'Sirf number likho' : 'Yahan jawab likho'}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleTypedSubmit()}
                disabled={loading || submitting}
              />
              <button
                onClick={handleTypedSubmit}
                style={styles.sendBtn}
                disabled={loading || submitting || !input.trim()}
              >
                Bhejo
              </button>
            </div>
          ) : null}
          {error && <p style={styles.error}>{error}</p>}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', background: 'linear-gradient(180deg, #f6f9f4 0%, #edf5ea 100%)', display: 'flex', flexDirection: 'column' },
  header: { display: 'flex', alignItems: 'center', gap: '1rem', background: '#fff', padding: '1rem 1.2rem', borderBottom: '1px solid #dbe5d8' },
  backBtn: { background: 'none', border: 'none', color: '#27500A', cursor: 'pointer', fontSize: '0.95rem', padding: 0 },
  title: { color: '#1f3320', margin: 0, fontSize: '1.15rem' },
  subtitle: { color: '#637269', margin: 0, fontSize: '0.84rem' },
  chatBox: { flex: 1, padding: '1rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.9rem' },
  msgRow: { display: 'flex', gap: '0.5rem', alignItems: 'flex-end' },
  aiAvatar: { width: '34px', height: '34px', borderRadius: '50%', background: '#27500A', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', fontWeight: 'bold', flexShrink: 0 },
  userAvatar: { width: '34px', height: '34px', borderRadius: '50%', background: '#085041', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 'bold', flexShrink: 0 },
  bubble: { maxWidth: '82%', padding: '0.85rem 0.95rem', borderRadius: '12px', boxShadow: '0 6px 16px rgba(26, 44, 33, 0.08)', border: '1px solid #dbe5d8' },
  bubbleText: { margin: 0, whiteSpace: 'pre-line', lineHeight: 1.5 },
  optionList: { marginTop: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' },
  optionBtn: { textAlign: 'left', padding: '0.72rem 0.82rem', borderRadius: '10px', border: '1px solid #d3dfd0', background: '#fbfdfb', color: '#244014', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '0.2rem' },
  optionMeta: { color: '#6a7764', fontSize: '0.78rem' },
  typingDots: { margin: 0, color: '#8c9886', letterSpacing: '4px' },
  inputWrap: { padding: '1rem', background: '#fff', borderTop: '1px solid #dbe5d8' },
  inputRow: { display: 'flex', gap: '0.6rem' },
  input: { flex: 1, padding: '0.82rem 0.95rem', border: '1px solid #d3dfd0', borderRadius: '10px', fontSize: '0.98rem', background: '#fbfdfb' },
  sendBtn: { padding: '0.82rem 1.3rem', background: '#27500A', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '0.92rem', fontWeight: '700' },
  resultCard: { margin: '1rem', background: '#fff', borderRadius: '14px', padding: '1.1rem', boxShadow: '0 8px 20px rgba(26, 44, 33, 0.08)', border: '1px solid #dbe5d8' },
  resultTitle: { margin: '0 0 0.4rem', color: '#27500A' },
  resultText: { margin: '0 0 1rem', color: '#4f6057' },
  qrImage: { width: '180px', height: '180px', display: 'block', margin: '0 auto 0.75rem' },
  verifyUrl: { margin: '0 0 1rem', color: '#6a7764', fontSize: '0.8rem', wordBreak: 'break-all', textAlign: 'center' },
  resultActions: { display: 'flex', gap: '0.7rem', flexWrap: 'wrap' },
  primaryBtn: { flex: 1, minWidth: '160px', padding: '0.78rem', background: '#27500A', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: '700' },
  secondaryBtn: { flex: 1, minWidth: '160px', padding: '0.78rem', background: '#f2f7ef', color: '#27500A', border: '1px solid #d3dfd0', borderRadius: '10px', cursor: 'pointer', fontWeight: '700' },
  error: { color: '#a12828', margin: '0.7rem 0 0', fontSize: '0.9rem' },
  uploadedImg: { maxWidth: '100%', maxHeight: '200px', borderRadius: '8px', objectFit: 'contain' },
  uploadRow: { display: 'flex', justifyContent: 'center', padding: '0.5rem 0' },
  uploadLabelBtn: { padding: '0.8rem 1.5rem', background: '#27500A', color: 'white', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'background-color 0.2s', width: 'fit-content', margin: '0 auto' }
};

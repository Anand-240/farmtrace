import { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { getMandiFloorForProduce } from '../lib/market';
import { 
  Bot, Send, Image as ImageIcon, ArrowLeft, 
  CheckCircle2, Sparkles, Loader2 
} from 'lucide-react';
import './AIAssistant.css';

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

const GRADE_OPTIONS = [
  { value: 'A', label: 'Grade A (Badiya)' },
  { value: 'B', label: 'Grade B (Theek)' },
  { value: 'C', label: 'Grade C (Ok)' }
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
  const [availableCrops, setAvailableCrops] = useState([]);
  const [flow, setFlow] = useState(null);
  const [form, setForm] = useState({});
  const [result, setResult] = useState(null);
  const [sellMarketFloor, setSellMarketFloor] = useState(null);
  const fileInputRef = useRef(null);
  const chatEndRef = useRef(null);
  // Free-form chat state
  const [chatMode, setChatMode] = useState('wizard'); // 'wizard' | 'freeChat'
  const [chatHistory, setChatHistory] = useState([]); // { role: 'user'|'assistant', content: string }[]
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

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

  const cropOptions = useMemo(() => {
    const crops = availableCrops.map(c => ({ value: c.name, label: c.name, meta: `Rate: ₹${c.price}/kg` }));
    return [...crops, { value: 'OTHER', label: 'Anya fasal', meta: 'Manual enter karein' }];
  }, [availableCrops]);

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
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, submitting]);

  useEffect(() => {
    const loadAssistant = async () => {
      try {
        const [bootRes, cropsRes] = await Promise.all([
          api.get('/ai/farmer-assistant/bootstrap'),
          api.get('/market/commodities')
        ]);
        
        setBootstrapData({
          produces: bootRes.data.produces || [],
          distributors: bootRes.data.distributors || []
        });
        setAvailableCrops(cropsRes.data.commodities || []);

        pushAiMessage(bootRes.data.greeting || `Namaste ${user.name}! Main aapka FarmTrace AI assistant hoon.`);
        askAction();
      } catch (err) {
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
        options: cropOptions
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

    if (!nextForm.qualityGrade) {
        setPrompt({
          key: 'qualityGrade',
          type: 'option',
          text: 'Gunvatta grade chuno.',
          options: GRADE_OPTIONS
        });
        return;
      }

    if (!nextForm.quantity) {
      setPrompt({
        key: 'quantity',
        type: 'number',
        text: 'Maatra (Quantity) kitni hai kg mein? Sirf number likho.'
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

    if (currentPrompt.key === 'uploadImage') {
        pushAiMessage('Kripya photo upload karo button se.');
        return;
    }

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
      const selected = cropOptions.find((item) => item.value === value || item.label.toLowerCase() === String(value).toLowerCase());
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
      const res = await api.post('/produce/register', {
        farmerName: form.farmerName || user.name,
        cropType,
        origin: form.origin,
        quantity: Number(form.quantity),
        qualityGrade: form.qualityGrade,
        farmPrice: Number(form.farmPrice)
      });

      const verifyUrl = `${window.location.origin}/verify/${res.data.produce._id}`;
      
      const finishRegistration = (produceData, txHash) => {
        setResult({
          type: 'register',
          title: 'Fasal blockchain pe register ho gayi',
          text: `${cropType} ki entry save ho gayi. QR aur verification link neeche hai.`,
          verifyUrl,
          txHash
        });
        pushAiMessage(`Fasal register ho gayi. ${cropType} ab FarmTrace par verified entry ke saath dikh rahi hai.`);
        setCurrentPrompt(null);
      };

      const jobId = res.data.jobId;
      if (jobId) {
        toast.promise(
          new Promise((resolve, reject) => {
            const checkJob = setInterval(async () => {
              try {
                const jobRes = await api.get(`/jobs/${jobId}`);
                if (jobRes.data.state === 'completed') {
                  clearInterval(checkJob);
                  finishRegistration(res.data.produce, jobRes.data.result?.transactionHash || 'Verified');
                  resolve();
                } else if (jobRes.data.state === 'failed') {
                  clearInterval(checkJob);
                  reject(new Error(jobRes.data.failedReason || 'Transaction failed'));
                }
              } catch (e) {
                clearInterval(checkJob);
                reject(e);
              }
            }, 2000);
          }),
          {
            loading: 'Writing to Blockchain...',
            success: '✅ Done',
            error: (err) => `Blockchain failed: ${err.message}`
          }
        );
      } else {
        finishRegistration(res.data.produce, 'Verified on Ledger');
      }
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
        pushAiMessage(`Kisan samman portal! You cannot sell below the Floor/MSP rate of ₹${floorPrice.toFixed(2)}/kg.`);
        return;
      }

      const res = await api.post('/ai/confirm-transfer', {
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

      const res = await api.post('/ai/disease-detect', formData);

      const data = res.data.data;
      const remedyHtml = `
        <div class="disease-result">
          <strong>Bimari:</strong> <span style="color: #b91c1c; font-weight: 800">${data.disease}</span><br/>
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

  // ── Free-form chat handler ─────────────────────────────────────────────────
  const handleFreeChatSubmit = async () => {
    const msg = chatInput.trim();
    if (!msg || chatLoading) return;
    setChatInput('');
    // Optimistically add user message
    const userEntry = { role: 'user', content: msg };
    const nextHistory = [...chatHistory, userEntry];
    setChatHistory(nextHistory);
    setChatLoading(true);
    try {
      // Send last 3 turns (6 messages) as history context
      const historyToSend = nextHistory.slice(-6);
      const res = await api.post('/ai/chat', {
        message: msg,
        history: historyToSend.slice(0, -1) // exclude the message we just added
      });
      const assistantEntry = { role: 'assistant', content: res.data.reply };
      setChatHistory(prev => [...prev, assistantEntry]);
    } catch (err) {
      const errEntry = { role: 'assistant', content: err.response?.data?.message || 'Kuch galat hua. Thodi der baad try karein.' };
      setChatHistory(prev => [...prev, errEntry]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="chat-container">
      <header className="chat-header">
        <button onClick={() => navigate('/dashboard')} className="chat-back-btn">
          <ArrowLeft size={18} /> Back
        </button>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#1a4a15' }}>FarmTrace AI Assistant</h2>
          <p style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Connected to Agri-Expert Cloud</p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <Sparkles size={20} color="#1a4a15" />
          {/* Tab toggle */}
          <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '8px', padding: '3px', gap: '2px' }}>
            <button
              onClick={() => setChatMode('wizard')}
              style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.75rem', background: chatMode === 'wizard' ? '#1a4a15' : 'transparent', color: chatMode === 'wizard' ? '#fff' : '#64748b', transition: 'all 0.2s' }}
            >Wizard</button>
            <button
              onClick={() => setChatMode('freeChat')}
              style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.75rem', background: chatMode === 'freeChat' ? '#1a4a15' : 'transparent', color: chatMode === 'freeChat' ? '#fff' : '#64748b', transition: 'all 0.2s' }}
            >Chat</button>
          </div>
        </div>
      </header>
      {chatMode === 'wizard' && (
        <>
        <div className="chat-messages">
          {messages.map((msg) => (
          <div key={msg.id} className="message-row">
            {msg.role === 'ai' && <div className="avatar ai-avatar"><Bot size={20} /></div>}
            <div className={`message-bubble ${msg.role === 'ai' ? 'ai-bubble' : 'user-bubble'}`}>
              {msg.type === 'image' ? (
                <img src={msg.imageUrl} alt="Uploaded leaf" className="uploaded-img" />
              ) : msg.html ? (
                <div dangerouslySetInnerHTML={{ __html: msg.html }} />
              ) : (
                <p>{msg.text}</p>
              )}
              {msg.options && currentPrompt?.key === msg.promptKey && (
                <div className="options-grid">
                  {msg.options.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleOptionSelect(option)}
                      disabled={submitting || loading}
                      className="option-pill"
                    >
                      <span className="option-label">{option.label}</span>
                      {option.meta && <small className="option-meta">{option.meta}</small>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {msg.role === 'user' && (
              <div className="avatar user-avatar">
                {(user.name || 'U').charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        ))}

        {result && (
          <div className="message-row">
            <div className="avatar ai-avatar"><CheckCircle2 size={20} /></div>
            <div className="message-bubble ai-bubble" style={{ border: '2px solid #1a4a15' }}>
              <h3 style={{ fontWeight: 900, color: '#1a4a15', marginBottom: '0.5rem' }}>{result.title}</h3>
              <p style={{ marginBottom: '1rem' }}>{result.text}</p>
              {result.verifyUrl && (
                <div style={{ textAlign: 'center', background: '#f8fafc', padding: '1.5rem', borderRadius: '16px' }}>
                  <QRCodeSVG value={result.verifyUrl} size={180} style={{ borderRadius: '12px', background: '#fff', padding: '10px' }} />
                  <p style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.75rem', wordBreak: 'break-all' }}>{result.verifyUrl}</p>
                </div>
              )}
              <button 
                onClick={() => navigate('/dashboard')} 
                className="ft-btn ft-btn-primary" 
                style={{ width: '100%', marginTop: '1.25rem' }}
              >
                Dashboard pe jao
              </button>
            </div>
          </div>
        )}

        {(loading || submitting) && (
          <div className="message-row">
            <div className="avatar ai-avatar"><Loader2 className="ft-anim-spin" size={20} /></div>
            <div className="message-bubble ai-bubble">
              <div className="typing-dots">
                <div className="dot" />
                <div className="dot" />
                <div className="dot" />
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Wizard input area */}
      <div className="chat-input-area">
        <div className="chat-input-card">
          <input
            className="chat-input"
            placeholder={currentPrompt?.type === 'image' ? 'Photo upload karein button se...' : 'Likhein yahan...'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleTypedSubmit()}
            type={isNumericPrompt ? 'number' : 'text'}
            disabled={submitting || loading || currentPrompt?.type === 'image'}
          />
          {currentPrompt?.type === 'image' && (
            <button
              type="button"
              onClick={() => fileInputRef.current.click()}
              className="send-btn"
              style={{ background: '#0284c7' }}
              disabled={submitting || loading}
            >
              <ImageIcon size={20} />
            </button>
          )}
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept="image/*"
            onChange={handleImageUpload}
          />
          <button
            onClick={handleTypedSubmit}
            disabled={!input.trim() || submitting || loading || currentPrompt?.type === 'image'}
            className="send-btn"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
      </>
      )}

      {/* ── FREE CHAT MODE ─────────────────────────────────────────── */}
      {chatMode === 'freeChat' && (
        <>
          <div className="chat-messages">
            {chatHistory.length === 0 && (
              <div className="message-row">
                <div className="avatar ai-avatar"><Bot size={20} /></div>
                <div className="message-bubble ai-bubble">
                  <p>Namaste {user.name}! 🌾 Main aapka FarmTrace AI hoon. Koi bhi sawaal puchh sakte hain — apni fasal, mandi rates, transfer, ya supply chain ke baare mein.</p>
                </div>
              </div>
            )}
            {chatHistory.map((msg, i) => (
              <div key={i} className="message-row">
                {msg.role === 'assistant' && <div className="avatar ai-avatar"><Bot size={20} /></div>}
                <div className={`message-bubble ${msg.role === 'assistant' ? 'ai-bubble' : 'user-bubble'}`}>
                  <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{msg.content}</p>
                </div>
                {msg.role === 'user' && (
                  <div className="avatar user-avatar">{(user.name || 'U').charAt(0).toUpperCase()}</div>
                )}
              </div>
            ))}
            {chatLoading && (
              <div className="message-row">
                <div className="avatar ai-avatar"><Loader2 className="ft-anim-spin" size={20} /></div>
                <div className="message-bubble ai-bubble">
                  <div className="typing-dots">
                    <div className="dot" /><div className="dot" /><div className="dot" />
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="chat-input-area">
            <div className="chat-input-card">
              <input
                className="chat-input"
                placeholder="Kuch bhi puchho — mandi rates, fasal, transfer..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleFreeChatSubmit()}
                disabled={chatLoading}
              />
              <button
                onClick={handleFreeChatSubmit}
                disabled={!chatInput.trim() || chatLoading}
                className="send-btn"
              >
                {chatLoading ? <Loader2 className="ft-anim-spin" size={20} /> : <Send size={20} />}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

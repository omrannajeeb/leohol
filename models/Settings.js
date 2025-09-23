import { useEffect, useState } from 'react';
import { Save, Plus, Trash2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../../../services/api';
import * as XLSX from 'xlsx';
import { useAuth } from '../../../context/AuthContext';

interface CheckoutFormConfig {
  showEmail: boolean;
  showLastName: boolean;
  showSecondaryMobile: boolean;
  showCountry: boolean;
  allowOtherCity: boolean;
  cities: string[];
}

const defaultConfig: CheckoutFormConfig = {
  showEmail: false,
  showLastName: false,
  showSecondaryMobile: false,
  showCountry: false,
  allowOtherCity: true,
  cities: [
    'ابو قويدر',
    'الجولان',
    'الريحانية',
    'الظهرية',
    'ام الفحم',
    'بديا',
    'بيت شيمش',
    'جفعات شموئل',
    'جولس',
    'حزمه',
    'حسنيه',
    'خضيرة',
    'دير رافات',
    'راس علي',
    'رحوفوت',
    'رمانه',
    'رموت هشفيم',
    'صندله',
    'طيرة الكرمل',
    'عين الاسد',
    'عين حوض',
    'كريات اتا',
    'كسرى سميع',
    'لهافيم',
    'معليا',
    'معلي افريم',
    'نهاريا',
    'نوف هجليل',
    'هود هشارون',
    'يوكنعام',
    'ירושלים',
    'الضفة الغربية',
    'منطقة ابو غوش',
    'الداخل',
    'قرى الخليل',
    'قباطية',
    'اريحا',
    'العيزرية',
    'الزعيم',
    'يطا',
    'بيت لحم',
    'الخليل',
    'طوباس',
    'طولكرم',
    'سلفيت',
    'ابو غوش',
    'جنين',
    'قلقيلية',
    'ابو ديس',
    'عين رافا',
    'حيفا',
    'عناتا',
    'سخنين',
    'ضواحي بيت لحم',
    'مخيم شعفاط',
    'ضواحي القدس',
    'السواحرة الشرقية',
    'إم الفحم',
    'البيرة',
    'عين نقوبا',
    'كفر عقب',
    'غزة',
    'ضواحي رام الله',
    'الرام',
    'رام الله',
    'نابلس',
    'ابطن',
    'ابو اسنان',
    'ابو تلول',
    'ابو سنان',
    'ابو قرينات',
    'اريال',
    'اشدود',
    'اشكلون',
    'اعبلين',
    'اكسال',
    'البعنه',
    'البعينة نجيدات',
    'البقيعة',
    'البلدة القديمة أبواب',
    'التله الفرنسيه',
    'الثوري ابوطور',
    'الجش',
    'الجولان',
    'الرامة',
    'الرامه',
    'الرملة',
    'الرينه',
    'الزرازير',
    'الشبلة',
    'الشيخ جراح',
    'الشيخ دنون',
    'الضاحية',
    'الطور',
    'الطيبة',
    'الطيبة الزعبية',
    'الطيرة',
    'العزير',
    'العيسويه',
    'الغجر',
    'الفريديس',
    'القدس',
    'الكعبية',
    'اللد',
    'اللقية',
    'المركز',
    'المزرعة',
    'المزرعه',
    'المشهد',
    'المشيرفه',
    'المغار',
    'الناصرة',
    'الناصره العليا',
    'الناعورة',
    'النقب',
    'النين',
    'ام الغنم',
    'ام القطف',
    'ام بطين',
    'اور يهودا',
    'ايلات',
    'بات يام',
    'بار يعكوف',
    'باقة الغربية',
    'برطعة',
    'بسمة طبعون',
    'بقعاتا',
    'بني براك',
    'بيت جان',
    'بيتح تكفا',
    'بيت حنينا',
    'بيت صفافا',
    'بير السبع',
    'بير السكة',
    'بير المشاش',
    'بير المكسور',
    'ترشيحا',
    'تل ابيب',
    'تل السبع',
    'تل عراد',
    'جبل المكبر',
    'جت',
    'جت الجليل',
    'جديدة',
    'جديده المكر',
    'جسر الزرقاء',
    'جلجوليا',
    'جلجولية',
    'جنوب',
    'حجاجره',
    'حرفيش',
    'حريش',
    'حورة',
    'حولون',
    'خوالد',
    'دالية الكرمل',
    'دبورية',
    'دير الاسد',
    'دير حنا',
    'ديمونا',
    'راس العامود',
    'رعنانا',
    'رمات جان',
    'رمات خوڤاڤ',
    'رهط',
    'روش هعاين',
    'رومانه',
    'ريشون لتسيون',
    'زلفة',
    'زيمر',
    'ساجور',
    'سالم',
    'سلوان',
    'سولم',
    'شارع يافا',
    'شبلي',
    'شعب',
    'شعفاط',
    'شفاعمر',
    'شفاعمرو',
    'شقيب السلام',
    'شمال بعيد',
    'شمال قريب',
    'شمال وسط',
    'صفد',
    'صور باهر',
    'ضميده',
    'طباش',
    'طبريا',
    'طرعان',
    'طمرة',
    'طمرة الزعبية',
    'طوبا الزنجريه',
    'عارة',
    'عرابة',
    'عرابه',
    'عراد',
    'عرب العرامشة',
    'عرب الهيب',
    'عرعرة (الشمال)',
    'عرعره النقب',
    'عسفيا',
    'عطروت',
    'عفولة',
    'عكا',
    'عيلبون',
    'عيلوط',
    'عين السهلة',
    'عين قينيا',
    'عين ماهل',
    'فريديس',
    'فسوطه',
    'قرية دريجات',
    'قصر السر',
    'قلنسوة',
    'كابول',
    'كرمئيل',
    'كريات اونو',
    'كريات شمونه',
    'كسيفه',
    'كعيبة',
    'كفر برا',
    'كفر سميع',
    'كفر قاسم',
    'كفرقرع',
    'كفر قرع',
    'كفر كما',
    'كفر كنا',
    'كفر مصر',
    'كفر مندا',
    'كفر ياسيف',
    'كمانة',
    'كوكب ابو الهيجا',
    'كيبوتس دان',
    'مثلث',
    'مجد الكروم',
    'مجدل شمس',
    'مسعدة',
    'مشيرفة',
    'مصمص',
    'معاوية',
    'مقيبلة',
    'مكر',
    'منشية الزبدة',
    'مولادا',
    'ميسر',
    'نتانيا',
    'نتانياا',
    'نتانيااا',
    'نحف',
    'نين',
    'هرتسيليا',
    'واد سلامة',
    'وادي الجوز',
    'وادي الحمام',
    'وادي سلامه',
    'وادي عارة',
    'يافا',
    'يافة الناصرة',
    'يانوح',
    'يركا',
    'כפר סבא'
  ]
};

export function CheckoutFormSettings() {
  const [config, setConfig] = useState<CheckoutFormConfig>(defaultConfig);
  const [loading, setLoading] = useState(false);
  const { isAuthenticated } = useAuth();

  const load = async () => {
    try {
      const { data } = await api.getWithRetry('/settings/checkout');
      setConfig({ ...defaultConfig, ...data, cities: Array.isArray(data?.cities) ? data.cities : defaultConfig.cities });
    } catch {
      toast.error('Failed to load checkout settings');
    }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      // Require authentication to save. Admin-only is enforced server-side by env/guard.
      if (!isAuthenticated) {
        toast.error('Please log in to save settings.');
        return;
      }
      setLoading(true);
      await api.putWithRetry('/settings/checkout', config);
      toast.success('Checkout settings saved');
    } catch (e: any) {
      // Rely on global API interceptor to show specific messages for 401/403/500.
      if (e?.response?.status === 401) {
        toast.error('Session expired. Please log in again.');
        setTimeout(() => { window.location.href = '/login'; }, 400);
      } else if (e?.response?.status === 403) {
        toast.error('You do not have permission to save these settings.');
      } else {
        toast.error('Failed to save checkout settings.');
      }
    } finally {
      setLoading(false);
    }
  };

  const addCity = () => {
    setConfig(prev => ({ ...prev, cities: [...prev.cities, ''] }));
  };

  const updateCity = (i: number, v: string) => {
    setConfig(prev => ({ ...prev, cities: prev.cities.map((c, idx) => idx === i ? v : c) }));
  };

  const removeCity = (i: number) => {
    setConfig(prev => ({ ...prev, cities: prev.cities.filter((_, idx) => idx !== i) }));
  };

  const handleUpload = async (file: File) => {
    try {
      const isCSV = /\.csv$/i.test(file.name);
      let workbook: XLSX.WorkBook;
      if (isCSV) {
        const text = await file.text();
        workbook = XLSX.read(text, { type: 'string' });
      } else {
        const data = await file.arrayBuffer();
        workbook = XLSX.read(data, { type: 'array' });
      }
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      if (!rows || rows.length === 0) {
        toast.error('The file is empty');
        return;
      }
      // Support either header row with 'city' or first-column values
      let list: string[] = [];
      const [firstRow, ...rest] = rows;
      const firstRowLower = firstRow.map((c: any) => String(c).toLowerCase().trim());
      const cityColIndex = firstRowLower.indexOf('city');
      if (cityColIndex >= 0) {
        list = rest.map(r => String(r[cityColIndex] || '').trim()).filter(Boolean);
      } else {
        list = rows.map(r => String((r as any)[0] || '').trim()).filter(Boolean);
      }
      // Normalize, dedupe
      const normalized = Array.from(new Set(list.map(c => c.replace(/\s+/g, ' ').trim())));
      if (normalized.length === 0) {
        toast.error('No city names found');
        return;
      }
      setConfig(prev => ({ ...prev, cities: normalized }));
      toast.success(`Loaded ${normalized.length} cities`);
    } catch (e) {
      toast.error('Failed to read file');
    }
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([["city"], ["Jerusalem"], ["Ramallah"]]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cities');
    XLSX.writeFile(wb, 'cities-template.xlsx');
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-gray-900">Checkout Form</h2>
        <button onClick={save} disabled={loading || !isAuthenticated} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white disabled:opacity-60">
          <Save className="w-4 h-4" /> {loading ? 'Saving…' : 'Save'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={config.showEmail} onChange={(e) => setConfig(prev => ({ ...prev, showEmail: e.target.checked }))} />
            <span>Show Email field</span>
          </label>
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={config.showLastName} onChange={(e) => setConfig(prev => ({ ...prev, showLastName: e.target.checked }))} />
            <span>Show Last Name field</span>
          </label>
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={config.showSecondaryMobile} onChange={(e) => setConfig(prev => ({ ...prev, showSecondaryMobile: e.target.checked }))} />
            <span>Show Secondary Mobile field</span>
          </label>
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={config.showCountry} onChange={(e) => setConfig(prev => ({ ...prev, showCountry: e.target.checked }))} />
            <span>Show Country field</span>
          </label>
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={config.allowOtherCity} onChange={(e) => setConfig(prev => ({ ...prev, allowOtherCity: e.target.checked }))} />
            <span>Allow "Other" city option</span>
          </label>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Cities</h3>
            <button type="button" onClick={addCity} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border">
              <Plus className="w-4 h-4" /> Add City
            </button>
          </div>
          <div className="flex items-center gap-3">
            <label className="inline-block">
              <span className="px-3 py-1.5 rounded-lg border cursor-pointer inline-flex items-center gap-2">Upload Excel/CSV</span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f);
                  e.currentTarget.value = '';
                }}
              />
            </label>
            <button type="button" onClick={downloadTemplate} className="px-3 py-1.5 rounded-lg border">Download template</button>
          </div>
          <div className="space-y-2">
            {config.cities.map((city, i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="text"
                  value={city}
                  onChange={(e) => updateCity(i, e.target.value)}
                  className="flex-1 px-3 py-2 border rounded-lg"
                  placeholder={`City ${i+1}`}
                />
                <button type="button" onClick={() => removeCity(i)} className="p-2 rounded-lg border text-red-600">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

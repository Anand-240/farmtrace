import { useLanguage } from '../lib/language';

export default function LanguageToggle({ style }) {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div style={{ ...styles.wrap, ...style }}>
      <span style={styles.label}>{t('common_lang')}</span>
      <button
        type="button"
        onClick={() => setLanguage('hi')}
        style={{ ...styles.btn, ...(language === 'hi' ? styles.btnActive : null) }}
      >
        HI
      </button>
      <button
        type="button"
        onClick={() => setLanguage('en')}
        style={{ ...styles.btn, ...(language === 'en' ? styles.btnActive : null) }}
      >
        EN
      </button>
    </div>
  );
}

const styles = {
  wrap: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    padding: '0.28rem 0.35rem',
    borderRadius: '999px',
    border: '1px solid #d7e3d3',
    background: '#f5faf3'
  },
  label: {
    fontSize: '0.72rem',
    fontWeight: 700,
    color: '#46604f',
    marginLeft: '0.25rem'
  },
  btn: {
    border: 'none',
    borderRadius: '999px',
    padding: '0.24rem 0.52rem',
    background: 'transparent',
    color: '#537162',
    cursor: 'pointer',
    fontSize: '0.72rem',
    fontWeight: 700
  },
  btnActive: {
    background: '#27500A',
    color: '#fff'
  }
};

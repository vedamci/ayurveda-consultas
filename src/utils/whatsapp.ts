export const onlyDigits = (value: string) => value.replace(/\D/g, '');

export const buildWhatsAppUrl = (phone: string, message?: string) => {
    const digits = onlyDigits(phone);
    if (!digits) return '';

    const normalized = digits.length === 10 ? `52${digits}` : digits;
    const text = message ? `?text=${encodeURIComponent(message)}` : '';
    return `https://wa.me/${normalized}${text}`;
};

export const professionalContact = {
    name: import.meta.env.VITE_PROFESSIONAL_NAME || 'Krishna Das',
    phone: import.meta.env.VITE_PROFESSIONAL_WHATSAPP || '3311967612',
    email: import.meta.env.VITE_PROFESSIONAL_EMAIL || '',
};

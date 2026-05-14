export interface LandingDescription {
  id: string;
  title: string;
  content: string;
  icon: string;
  image_url: string;
  text_align: string;
}

export interface SiteSettings {
  whatsapp_number: string;
  purchase_message: string;
  site_title: string;
  whatsapp_channel: string;
  subscription_info: string;
  landing_description_width: string;
  landing_desc_subtitle: string;
  landing_desc_title: string;
  landing_desc_quote: string;
  landing_desc_layout: string;
  announcement_text: string;
  announcement_enabled: string;
  [key: string]: string;
}

export interface MenuItem {
  icon: React.ReactNode;
  label: string;
  description: string;
  action: () => void;
}

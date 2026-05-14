import { motion } from "framer-motion";
import type { LandingDescription, SiteSettings } from "./types";

interface Props {
  descriptions: LandingDescription[];
  settings: SiteSettings;
}

const DescriptionsSection = ({ descriptions, settings }: Props) => {
  if (descriptions.length === 0) return null;
  const hasHeader = settings.landing_desc_subtitle || settings.landing_desc_title || settings.landing_desc_quote;

  return (
    <section className="py-10 tv:py-16">
      <div className="mx-auto max-w-7xl tv:max-w-[1800px] px-4 tv:px-8">
        {hasHeader && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-12 text-center tv:mb-16"
          >
            {settings.landing_desc_subtitle && (
              <p className="mb-3 text-sm font-bold uppercase tracking-widest text-primary tv:text-base">
                {settings.landing_desc_subtitle}
              </p>
            )}
            {settings.landing_desc_title && (
              <h2 className="mb-4 text-3xl font-extrabold text-foreground md:text-4xl tv:text-6xl">
                {settings.landing_desc_title.split(/(\*[^*]+\*)/).map((part, idx) =>
                  part.startsWith("*") && part.endsWith("*") ? (
                    <span key={idx} className="text-primary">{part.slice(1, -1)}</span>
                  ) : (
                    <span key={idx}>{part}</span>
                  )
                )}
              </h2>
            )}
            {settings.landing_desc_quote && (
              <p className="mx-auto max-w-2xl text-sm italic text-muted-foreground md:text-base tv:text-lg tv:max-w-3xl">
                "{settings.landing_desc_quote}"
              </p>
            )}
          </motion.div>
        )}

        {settings.landing_desc_layout === "cards" ? (
          <div className="grid gap-6 tv:gap-8 md:grid-cols-2 lg:grid-cols-3">
            {descriptions.map((desc, i) => (
              <motion.div
                key={desc.id}
                initial={{ opacity: 0, y: 30, scale: 0.97 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className={`group relative overflow-hidden rounded-2xl border border-primary/20 bg-card/90 backdrop-blur-sm p-6 md:p-8 tv:p-10 transition-all duration-300 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/10 ${desc.text_align === "left" ? "text-left" : desc.text_align === "right" ? "text-right" : desc.text_align === "justify" ? "text-justify" : "text-center"}`}
              >
                {desc.image_url && (
                  <img src={desc.image_url} alt={desc.title} className="mb-4 h-40 w-full rounded-xl object-cover" />
                )}
                <span className={`mb-4 flex h-12 w-12 tv:h-16 tv:w-16 items-center justify-center rounded-xl bg-primary/15 text-2xl tv:text-3xl ${desc.text_align === "center" ? "mx-auto" : desc.text_align === "right" ? "ml-auto" : ""}`}>
                  {desc.icon}
                </span>
                <h3 className="mb-3 text-lg font-bold text-foreground md:text-xl tv:text-2xl">{desc.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed tv:text-base whitespace-pre-line">{desc.content}</p>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="space-y-6 tv:space-y-8">
            {descriptions.map((desc, i) => {
              const alignClass = desc.text_align === "left" ? "text-left" : desc.text_align === "right" ? "text-right" : desc.text_align === "justify" ? "text-justify" : "text-center";
              return (
                <motion.div
                  key={desc.id}
                  initial={{ opacity: 0, y: 30, scale: 0.97 }}
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.6, delay: i * 0.1, ease: "easeOut" }}
                  className={`group relative w-full overflow-hidden rounded-2xl border border-border bg-card/80 backdrop-blur-sm transition-all duration-300 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 ${alignClass}`}
                >
                  {desc.image_url ? (
                    <div className="md:flex">
                      <div className="relative h-52 overflow-hidden md:h-auto md:w-2/5 lg:w-1/3">
                        <img
                          src={desc.image_url}
                          alt={desc.title}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-card/20 md:bg-gradient-to-l" />
                      </div>
                      <div className="flex flex-1 flex-col justify-center p-6 md:p-8 tv:p-12">
                        <span className="mb-3 inline-block text-3xl tv:text-5xl">{desc.icon}</span>
                        <h3 className="mb-3 text-xl font-bold text-foreground md:text-2xl tv:text-3xl">{desc.title}</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed md:text-base tv:text-lg whitespace-pre-line">{desc.content}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 md:p-8 tv:p-12">
                      <span className="mb-3 inline-block text-3xl tv:text-5xl">{desc.icon}</span>
                      <h3 className="mb-3 text-xl font-bold text-foreground md:text-2xl tv:text-3xl">{desc.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed md:text-base tv:text-lg whitespace-pre-line">{desc.content}</p>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

export default DescriptionsSection;

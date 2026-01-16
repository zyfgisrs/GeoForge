import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import enUS from "./locales/en-US.json";
import zhCN from "./locales/zh-CN.json";

import arSA from "./locales/ar-SA.json";
import deDE from "./locales/de-DE.json";
import esES from "./locales/es-ES.json";
import frFR from "./locales/fr-FR.json";
import hiIN from "./locales/hi-IN.json";
import jaJP from "./locales/ja-JP.json";
import koKR from "./locales/ko-KR.json";
import ptBR from "./locales/pt-BR.json";
import ruRU from "./locales/ru-RU.json";
import zhTW from "./locales/zh-TW.json";

const resources = {
  "zh-CN": {
    translation: zhCN,
  },
  "zh-TW": {
    translation: zhTW,
  },
  "en-US": {
    translation: enUS,
  },
  "ko-KR": {
    translation: koKR,
  },
  "ja-JP": {
    translation: jaJP,
  },
  "fr-FR": {
    translation: frFR,
  },
  "es-ES": {
    translation: esES,
  },
  "ru-RU": {
    translation: ruRU,
  },
  "ar-SA": {
    translation: arSA,
  },
  "de-DE": {
    translation: deDE,
  },
  "hi-IN": {
    translation: hiIN,
  },
  "pt-BR": {
    translation: ptBR,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "zh-CN",
    debug: true,
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
    },
  });

export default i18n;

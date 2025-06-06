import { Libre_Baskerville, Montserrat, Playfair_Display } from "next/font/google";
import localFont from "next/font/local";

export const roaldDahl = localFont({ src: "./RoaldDahlWonkyBold.woff" });
export const libre = Libre_Baskerville({ weight: ["700"], subsets: ["latin"] });
export const playfair = Playfair_Display({ 
  weight: ["700"], 
  subsets: ["latin"],
  display: "swap"
});
export const montserrat = Montserrat({ 
  weight: ["700"], 
  subsets: ["latin"],
  display: "swap" 
});

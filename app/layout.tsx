import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title:"ECHO//WAR — Temporal FPS", description:"Prototip jugable d'un FPS roguelike on cada derrota es converteix en un aliat temporal." };
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="ca"><body>{children}</body></html>}

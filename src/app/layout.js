import '../styles/main.css'; 

export const metadata = {
  title: 'Módulo de Laboratorio',
  description: 'Gestión profesional de tipos de exámenes y reportes clínicos.',
};


export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1, 
};


export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        {children}
      </body>
    </html>
  );
}
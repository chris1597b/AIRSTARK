
export interface AnatomicalPart {
  id: string;
  label: string;
  description: string;
  position: string; // "x y z" or data-surface string
  normal: string;   // Not strictly used with data-surface but kept for interface compatibility
  keywords: string[];
}

export enum AppMode {
  EXPLORE = 'EXPLORE',
  NAVIGATION = 'NAVIGATION',
  QUIZ = 'QUIZ',

}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export interface GestureState {
  isActive: boolean;
  mode: 'IDLE' | 'ROTATING' | 'ZOOMING' | 'LOCKED' | 'VOICE';
  feedback: string;
}

export const ANATOMY_DATA: AnatomicalPart[] = [
  {
    id: "hotspot-2",
    label: "Aorta",
    description: "Arteria principal que transporta sangre oxigenada desde el ventrículo izquierdo a todo el cuerpo.",
    position: "0 0 1720 1427 1941 0.773 0.089 0.138",
    normal: "0 1 0",
    keywords: ["aorta", "arco aórtico", "arteria aorta", "la aorta"]
  },
  {
    id: "hotspot-3",
    label: "Arteria Pulmonar",
    description: "Transporta sangre desoxigenada desde el ventrículo derecho hacia los pulmones para su oxigenación.",
    position: "0 0 5331 4890 5472 0.525 0.177 0.298",
    normal: "0 0 1",
    keywords: ["arteria pulmonar", "pulmonar"]
  },
  {
    id: "hotspot-4",
    label: "Venas Pulmonares",
    description: "Conjunto de venas que transportan sangre oxigenada desde los pulmones a la aurícula izquierda.",
    position: "0 0 6694 6319 6539 0.468 0.358 0.174",
    normal: "0 0 1",
    keywords: ["venas pulmonares"]
  },
  {
    id: "hotspot-5",
    label: "Aurícula Izquierda",
    description: "Cámara cardíaca que recibe sangre oxigenada de las venas pulmonares y la bombea al ventrículo izquierdo.",
    position: "0 0 4918 4164 4197 0.562 0.271 0.167",
    normal: "1 0 0",
    keywords: ["aurícula izquierda", "atrio izquierdo"]
  },
  {
    id: "hotspot-6",
    label: "Válvula Mitral",
    description: "Válvula bicúspide que regula el flujo sanguíneo entre la aurícula izquierda y el ventrículo izquierdo.",
    position: "0 0 5640 5464 5567 0.691 0.250 0.059",
    normal: "0 1 0",
    keywords: ["mitral", "válvula mitral"]
  },
  {
    id: "hotspot-7",
    label: "Válvula Aórtica",
    description: "Válvula semilunar que permite el paso de sangre del ventrículo izquierdo a la aorta, impidiendo el reflujo.",
    position: "0 0 2197 2469 2381 0.533 0.117 0.350",
    normal: "0 1 0",
    keywords: ["aórtica", "válvula aórtica"]
  },
  {
    id: "hotspot-8",
    label: "Ventrículo Izquierdo",
    description: "Cámara muscular de pared gruesa que bombea sangre oxigenada a alta presión hacia la circulación sistémica.",
    position: "0 0 5506 6130 5791 0.067 0.265 0.668",
    normal: "-1 0 0",
    keywords: ["ventrículo izquierdo"]
  },
  {
    id: "hotspot-9",
    label: "Ventrículo Derecho",
    description: "Cámara que recibe sangre de la aurícula derecha y la bombea a baja presión hacia los pulmones.",
    position: "0 0 301 295 8493 0.854 0.014 0.132",
    normal: "0 -1 0",
    keywords: ["ventrículo derecho"]
  },
  {
    id: "hotspot-10",
    label: "Pericardio",
    description: "Saco fibroseroso de doble capa que envuelve y protege al corazón.",
    position: "0 0 6515 7028 7357 0.228 0.038 0.734",
    normal: "0 0 1",
    keywords: ["pericardio"]
  },
  {
    id: "hotspot-11",
    label: "Válvula Pulmonar",
    description: "Válvula semilunar que regula el flujo desde el ventrículo derecho hacia la arteria pulmonar.",
    position: "0 0 9799 9739 9977 0.183 0.228 0.590",
    normal: "0 1 0",
    keywords: ["válvula pulmonar"]
  },
  {
    id: "hotspot-12",
    label: "Válvula Tricúspide",
    description: "Válvula que separa la aurícula derecha del ventrículo derecho, evitando el retorno de sangre.",
    position: "0 0 15849 15484 15719 0.319 0.377 0.304",
    normal: "0 0 -1",
    keywords: ["tricúspide", "válvula tricúspide"]
  },
  {
    id: "hotspot-13",
    label: "Tronco Pulmonar",
    description: "Vaso grande que sale del ventrículo derecho y se bifurca en las arterias pulmonares izquierda y derecha.",
    position: "0 0 8177 147 8707 0.125 0.120 0.755",
    normal: "0 1 0",
    keywords: ["tronco pulmonar"]
  },
  {
    id: "hotspot-14",
    label: "Aurícula Derecha",
    description: "Cámara que recibe sangre desoxigenada de las venas cavas y la envía al ventrículo derecho.",
    position: "0 0 17572 16917 16898 0.019 0.475 0.506",
    normal: "1 1 0",
    keywords: ["aurícula derecha", "atrio derecho"]
  },
  {
    id: "hotspot-15",
    label: "Vena Cava Superior",
    description: "Gran vena que transporta la sangre desoxigenada desde la mitad superior del cuerpo hacia la aurícula derecha.",
    position: "0 0 17346 17940 17918 0.066 0.620 0.314",
    normal: "0 1 0",
    keywords: ["vena cava", "cava superior"]
  }
];

export interface AnatomicalPart {
  id: string;
  label: string;
  description: string;
  position: string; // "x y z" or data-surface string
  normal: string;   // Not strictly used with data-surface but kept for interface compatibility
  keywords: string[];
  isInternal?: boolean;
}

export enum AppMode {
  EXPLORE = 'EXPLORE',
  NAVIGATION = 'NAVIGATION',
  QUIZ = 'QUIZ',
  DRAW = 'DRAW',
  EVALUATION = 'EVALUATION',
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
    label: "Tronco Pulmonar",
    description: "Vaso grande que sale del ventrículo derecho y se bifurca en las arterias pulmonares izquierda y derecha.",
    position: "0.058432014574736346m 1.327044941010444m 0.2445529018042828m",
    normal: "0.48430408769149835m 0.7147156719355336m 0.5046098085997182m",
    keywords: ["tronco pulmonar"]
  },
  {
    id: "hotspot-3",
    label: "Arteria Pulmonar Izq",
    description: "Rama de la arteria pulmonar que transporta sangre desoxigenada al pulmón izquierdo.",
    position: "0.07495890838420571m 1.3490206429306453m 0.039576188779720994m",
    normal: "0.5067946574449339m 0.8605261032530598m -0.05151699530617748m",
    keywords: ["arteria pulmonar", "pulmonar izquierda", "arteria pulmonar izq"]
  },
  {
    id: "hotspot-4",
    label: "Aurícula Izq",
    description: "Cámara cardíaca que recibe sangre oxigenada de las venas pulmonares y la bombea al ventrículo izquierdo.",
    position: "0.1377512319179388m 1.234703278536107m 0.2153406593903776m",
    normal: "0.6688216964148902m 0.7165922358692322m 0.19792196921171615m",
    keywords: ["aurícula izquierda", "atrio izquierdo", "auricula izq"]
  },
  {
    id: "hotspot-7",
    label: "Válvula mitral (Bicúspide)",
    description: "Válvula que regula el flujo sanguíneo entre la aurícula izquierda y el ventrículo izquierdo.",
    position: "0.00409069354794378m 1.1019200812076964m 0.07169809936638157m",
    normal: "0.5988054671827376m -0.5650090186680035m 0.567623837850282m",
    keywords: ["mitral", "válvula mitral", "bicúspide"],
    isInternal: true
  },
  {
    id: "hotspot-8",
    label: "Válvula Aórtica",
    description: "Válvula semilunar que permite el paso de sangre del ventrículo izquierdo a la aorta, impidiendo el reflujo.",
    position: "0.016290469733741708m 1.153768719746921m 0.15194698718338565m",
    normal: "0.4833247712561434m -0.764322163158838m 0.42685922315722696m",
    keywords: ["aórtica", "válvula aórtica"],
    isInternal: true
  },
  {
    id: "hotspot-10",
    label: "Válvula Pulmonar",
    description: "Válvula semilunar que regula el flujo desde el ventrículo derecho hacia la arteria pulmonar.",
    position: "0.046234692799701965m 1.1796909785470842m 0.32471727629734615m",
    normal: "-0.04451312718254133m -0.841107437526709m 0.5390332643220492m",
    keywords: ["válvula pulmonar"],
    isInternal: true
  },
  {
    id: "hotspot-11",
    label: "Ventrículo Izq",
    description: "Cámara muscular de pared gruesa que bombea sangre oxigenada a alta presión hacia la circulación sistémica.",
    position: "0.08394413072370488m 0.9340456478507595m 0.13643895451892685m",
    normal: "-0.38472601707618564m 0.5861711225383753m 0.7130142403113668m",
    keywords: ["ventrículo izquierdo", "ventriculo izq"],
    isInternal: true
  },
  {
    id: "hotspot-12",
    label: "Músculo papilar",
    description: "Músculos situados en los ventrículos cardíacos a los que se unen las cuerdas tendinosas.",
    position: "0.10909245019501435m 0.9913315762369221m 0.2525005271837031m",
    normal: "0.847236429287647m 0.1416848290924165m -0.5119725013054616m",
    keywords: ["músculo papilar", "papilar"],
    isInternal: true
  },
  {
    id: "hotspot-14",
    label: "Pericardio",
    description: "Saco fibroseroso de doble capa que envuelve y protege al corazón.",
    position: "0.18946615912112252m 0.9310496350166486m 0.3456162622111795m",
    normal: "0.5777014654013969m 0.48627069806280726m 0.6555927280549938m",
    keywords: ["pericardio"]
  },
  {
    id: "hotspot-15",
    label: "Vena cava inferior",
    description: "Gran vena que transporta la sangre desoxigenada desde la mitad inferior del cuerpo hacia la aurícula derecha.",
    position: "-0.17846944968172396m 0.8612175476853613m 0.18881579086687397m",
    normal: "-0.6147235117043632m 0.12721081301635256m 0.7784166064579907m",
    keywords: ["vena cava inferior", "cava inferior"]
  },
  {
    id: "hotspot-16",
    label: "Banda Moderadora",
    description: "Banda muscular que se extiende desde el tabique interventricular hasta la pared anterior del ventrículo derecho.",
    position: "0.0771558616618272m 0.9976929826199129m 0.33968621331308513m",
    normal: "0.707145148523129m -0.00002277547550447527m 0.7070684114012445m",
    keywords: ["banda moderadora"],
    isInternal: true
  },
  {
    id: "hotspot-18",
    label: "Cuerdas Tendinosas",
    description: "Estructuras fibrosas que conectan los músculos papilares a las válvulas atrioventriculares.",
    position: "-0.06355864081328183m 1.000361115657767m 0.2708459822892789m",
    normal: "-0.35811550366213557m 0.503145482532294m 0.7865099550826805m",
    keywords: ["cuerdas tendinosas"],
    isInternal: true
  },
  {
    id: "hotspot-19",
    label: "Ventrículo Der",
    description: "Cámara que recibe sangre de la aurícula derecha y la bombea a baja presión hacia los pulmones.",
    position: "-0.018630802475897656m 0.9548223863153603m 0.18183759440759142m",
    normal: "-0.4959093704113171m 0.17710885890727415m 0.8501213727667447m",
    keywords: ["ventrículo derecho", "ventriculo der"],
    isInternal: true
  },
  {
    id: "hotspot-20",
    label: "Venas pulmonares Der",
    description: "Conjunto de venas que transportan sangre oxigenada desde el pulmón derecho a la aurícula izquierda.",
    position: "-0.1610643091856082m 1.1286436403062532m 0.0006700008919344191m",
    normal: "-0.868170490015939m 0.45214404225824767m -0.20456237512273934m",
    keywords: ["venas pulmonares derechas", "venas pulmonares der"]
  },
  {
    id: "hotspot-21",
    label: "Venas pulmonares Izq",
    description: "Conjunto de venas que transportan sangre oxigenada desde el pulmón izquierdo a la aurícula izquierda.",
    position: "0.07688853477341506m 1.148667601379062m 0.00915714510978189m",
    normal: "0.850918125465458m 0.06627351800791142m -0.5211009159128452m",
    keywords: ["venas pulmonares izquierdas", "venas pulmonares izq"]
  },
  {
    id: "hotspot-22",
    label: "Arteria Pulmonar Der",
    description: "Rama de la arteria pulmonar que transporta sangre desoxigenada al pulmón derecho.",
    position: "-0.17296667912261832m 1.2830950694706587m 0.028167924729537212m",
    normal: "-0.18448642303780194m 0.4799450023729455m -0.8576814993993694m",
    keywords: ["arteria pulmonar derecha", "arteria pulmonar der"]
  },
  {
    id: "hotspot-23",
    label: "Vena Cava Sup",
    description: "Gran vena que transporta la sangre desoxigenada desde la mitad superior del cuerpo hacia la aurícula derecha.",
    position: "-0.15169518199669108m 1.4868508374311094m 0.21250673810667572m",
    normal: "0.5024431322320674m -0.1760178796904441m 0.8465037536255288m",
    keywords: ["vena cava superior", "cava sup"]
  },
  {
    id: "hotspot-24",
    label: "Aorta",
    description: "Arteria principal que transporta sangre oxigenada desde el ventrículo izquierdo a todo el cuerpo.",
    position: "0.033350619018065464m 1.4730417629070685m 0.07528921455974252m",
    normal: "0.9427351325240989m 0.24474506769488796m 0.22660609379227778m",
    keywords: ["aorta", "arco aórtico", "arteria aorta"]
  }
];
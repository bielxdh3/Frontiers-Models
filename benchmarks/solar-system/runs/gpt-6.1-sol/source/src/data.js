export const REFERENCE_DATE = '2026-10-22';
export const SOURCES = {
  planets: {name:'JPL · Planetary physical parameters',url:'https://ssd.jpl.nasa.gov/planets/phys_par.html'},
  elements: {name:'JPL · Approximate planetary positions, table 1',url:'https://ssd.jpl.nasa.gov/planets/approx_pos.html'},
  moons: {name:'JPL · Satellite physical parameters',url:'https://ssd.jpl.nasa.gov/sats/phys_par/'},
  satelliteOrbits: {name:'JPL · Satellite mean elements',url:'https://ssd.jpl.nasa.gov/sats/elem/'},
  moon: {name:'NASA · Moon fact sheet',url:'https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html'},
  seasons: {name:'NASA · Spin, tilt and orbit',url:'https://science.nasa.gov/learn/heat/resource/earths-spin-tilt-and-orbit/'},
  phases: {name:'NASA · Lunar phases and eclipses',url:'https://science.nasa.gov/moon/eclipses/'},
  small: {name:'NASA · Dwarf planets',url:'https://science.nasa.gov/dwarf-planets/'},
  comet: {name:'NASA · Comet facts',url:'https://science.nasa.gov/solar-system/comets/facts/'},
  textures: {name:'Solar System Scope / INOVE · CC BY 4.0',url:'https://www.solarsystemscope.com/textures/'},
  system: {name:'NASA · Solar System facts',url:'https://science.nasa.gov/solar-system/solar-system-facts/'}
};
// Table 1: a [AU], e, I, L, longitude of perihelion, longitude of node;
// angular elements are degrees, rates are per Julian century from J2000 TDB.
const planetRows = [
 ['mercury','Mercúrio','Mercury',2439.4,3.30103e23,5.4289,3.70,58.6462,87.9691,0.034,440,'#b7aaa1', [0.38709927,.20563593,7.00497902,252.25032350,77.45779628,48.33076593],[.00000037,.00001906,-.00594749,149472.67411175,.16047689,-.12534081]],
 ['venus','Vênus','Venus',6051.8,4.86731e24,5.243,8.87,-243.018,224.701,177.36,737,'#d9bd8d',[.72333566,.00677672,3.39467605,181.97909950,131.60246718,76.67984255],[.00000390,-.00004107,-.00078890,58517.81538729,.00268329,-.27769418]],
 ['earth','Terra','Earth',6371.0084,5.97217e24,5.5134,9.80,.99726968,365.25636,23.4393,288,'#7aafd0',[1.00000261,.01671123,-.00001531,100.46457166,102.93768193,0],[.00000562,-.00004392,-.01294668,35999.37244981,.32327364,0]],
 ['mars','Marte','Mars',3389.5,6.41691e23,3.934,3.71,1.02595676,686.98,25.19,210,'#d58c6d',[1.52371034,.09339410,1.84969142,-4.55343205,-23.94362959,49.55953891],[.00001847,.00007882,-.00813131,19140.30268499,.44441088,-.29257343]],
 ['jupiter','Júpiter','Jupiter',69911,1.898125e27,1.3262,24.79,.41354,4332.589,3.13,165,'#d7b48b',[5.20288700,.04838624,1.30439695,34.39644051,14.72847983,100.47390909],[-.00011607,-.00013253,-.00183714,3034.74612775,.21252668,.20469106]],
 ['saturn','Saturno','Saturn',58232,5.68317e26,.6871,10.44,.44401,10759.22,26.73,134,'#dfcda7',[9.53667594,.05386179,2.48599187,49.95424423,92.59887831,113.66242448],[-.00125060,-.00050991,.00193609,1222.49362201,-.41897216,-.28867794]],
 ['uranus','Urano','Uranus',25362,8.68099e25,1.270,8.87,-.71833,30685.4,97.77,76,'#a9d7da',[19.18916464,.04725744,.77263783,313.23810451,170.95427630,74.01692503],[-.00196176,-.00004397,-.00242939,428.48202785,.40805281,.04240589]],
 ['neptune','Netuno','Neptune',24622,1.024092e26,1.638,11.15,.67125,60189,28.32,72,'#698fd0',[30.06992276,.00859048,1.77004347,-55.12002969,44.96476227,131.78422574],[.00026291,.00005105,.00035372,218.45945325,-.32241464,-.00508664]]
];
const descriptions = {
 sun:['A estrela que conecta todos os nossos mundos. Seu calor e sua gravidade dão ritmo ao Sistema Solar.','The star connecting all our worlds. Its heat and gravity set the rhythm of the Solar System.'],
 mercury:['Pequeno, rochoso e marcado por crateras. Mercúrio completa sua volta ao Sol em apenas 88 dias terrestres.','Small, rocky and cratered. Mercury travels around the Sun in just 88 Earth days.'],
 venus:['Sob um manto de nuvens, um mundo de extremos. Sua atmosfera densa mantém a superfície mais quente que a de Mercúrio.','Beneath a veil of clouds, a world of extremes. Its dense atmosphere keeps its surface hotter than Mercury.'],
 earth:['Nosso pequeno ponto azul. Oceanos, continentes e uma fina atmosfera abrigam o único mundo onde conhecemos vida.','Our little blue dot. Oceans, continents and a thin atmosphere shelter the only world known to host life.'],
 mars:['Desertos vermelhos e vestígios de um passado com água. Um mundo rochoso que nos convida a olhar mais longe.','Red deserts and traces of a watery past. A rocky world inviting us to look farther.'],
 jupiter:['Um gigante de nuvens e tempestades. Mais massivo que todos os outros planetas juntos, tem seu próprio conjunto de mundos.','A giant of clouds and storms. More massive than all the other planets combined, with a family of worlds of its own.'],
 saturn:['Um mundo leve, cercado de gelo. Seus anéis são incontáveis partículas em órbita, e não uma superfície sólida.','A light world surrounded by ice. Its rings are countless orbiting particles, rather than a solid surface.'],
 uranus:['Um gigante de gelo que gira quase deitado. Sua inclinação extrema cria estações muito diferentes das nossas.','An ice giant spinning almost on its side. Its extreme tilt creates seasons very different from ours.'],
 neptune:['Ventos intensos em um mundo distante. Netuno leva quase 165 anos terrestres para completar sua órbita.','Intense winds on a distant world. Neptune takes almost 165 Earth years to complete an orbit.'],
 moon:['Uma companheira de face familiar. A Lua gira uma vez a cada órbita e mantém aproximadamente o mesmo hemisfério voltado para a Terra.','A familiar-faced companion. The Moon rotates once per orbit, keeping roughly the same hemisphere facing Earth.'],
 phobos:['Uma pequena lua irregular que orbita Marte mais rápido do que o planeta gira.','A small irregular moon orbiting Mars faster than the planet rotates.'],
 deimos:['A menor das duas luas de Marte, coberta por um manto de material fino.','The smaller of Mars’s two moons, covered in fine surface material.'],
 io:['Um mundo amarelo e vulcânico, constantemente deformado pelas forças de maré de Júpiter.','A yellow volcanic world continually flexed by Jupiter’s tidal forces.'],
 europa:['Uma crosta de gelo fraturada recobre um mundo com fortes evidências de um oceano interno.','A fractured ice crust covers a world with strong evidence for an internal ocean.'],
 ganymede:['A maior lua do Sistema Solar. Ganimedes é maior que Mercúrio, mas tem muito menos massa.','The largest moon in the Solar System. Ganymede is larger than Mercury but much less massive.'],
 callisto:['Uma antiga paisagem de gelo e rocha preserva uma longa história de impactos.','An ancient landscape of ice and rock preserves a long history of impacts.'],
 titan:['Uma lua envolta em névoa. Rios e lagos de hidrocarbonetos tornam sua superfície extraordinária.','A haze-wrapped moon. Hydrocarbon rivers and lakes make its surface extraordinary.'],
 enceladus:['Gelo brilhante e atividade no polo sul: Encélado é uma janela para os mundos oceânicos.','Bright ice and south-polar activity: Enceladus offers a window into ocean worlds.'],
 miranda:['Cânions e terrenos muito diferentes revelam uma história geológica complexa.','Canyons and strikingly varied terrain reveal a complex geological history.'],
 ariel:['Um mundo de gelo cortado por vales e cânions, na família de Urano.','An icy world cut by valleys and canyons in the Uranian family.'],
 umbriel:['Uma lua escura e repleta de crateras que guarda marcas de impactos antigos.','A dark, heavily cratered moon retaining the marks of ancient impacts.'],
 titania:['A maior lua de Urano combina crateras e grandes sistemas de falhas.','Uranus’s largest moon combines craters and large fault systems.'],
 oberon:['Gelo e rocha em uma lua distante, com grandes crateras escuras.','Ice and rock on a distant moon with large dark craters.'],
 triton:['Uma lua gelada que percorre uma órbita retrógrada ao redor de Netuno.','An icy moon traveling in a retrograde orbit around Neptune.'],
 charon:['A grande companheira de Plutão. Seu tamanho torna esse par especialmente interessante.','Pluto’s large companion. Its size makes this pair particularly interesting.'],
 pluto:['Montanhas de gelo e planícies de nitrogênio: um planeta anão de surpreendente diversidade.','Ice mountains and nitrogen plains: a dwarf planet of surprising diversity.'],
 ceres:['O maior objeto do cinturão de asteroides e o único planeta anão do Sistema Solar interior.','The largest asteroid-belt object and the only dwarf planet in the inner Solar System.'],
 eris:['Um planeta anão em uma órbita muito inclinada e alongada. A aparência aqui é ilustrativa.','A dwarf planet on a highly inclined, elongated orbit. Its appearance here is illustrative.'],
 haumea:['Um mundo alongado que gira rapidamente. A forma e a superfície são representações educativas.','An elongated, rapidly spinning world. Shape and surface are educational representations.'],
 makemake:['Um planeta anão frio da região transnetuniana. Os detalhes de sua superfície ainda são limitados.','A cold trans-Neptunian dwarf planet. Detailed knowledge of its surface is still limited.'],
 vesta:['Um asteroide de forma irregular, visitado pela missão Dawn. Um vestígio da formação dos planetas.','An irregular asteroid visited by Dawn. A remnant from the formation of the planets.'],
 comet:['Um cometa hipotético para explorar caudas e órbitas alongadas. Sua cauda iônica aponta para longe do Sol.','A hypothetical comet for exploring tails and elongated orbits. Its ion tail points away from the Sun.'],
 asteroidBelt:['Uma população de pequenos corpos entre Marte e Júpiter. Os pontos exibidos são representativos.','A population of small bodies between Mars and Jupiter. The displayed points are representative.'],
 kuiperBelt:['Uma ampla região de mundos gelados além de Netuno. Sua população é representada de forma esquemática.','A broad region of icy worlds beyond Neptune. Its population is represented schematically.'],
 oortCloud:['Uma região hipotética muito distante, mostrada apenas em contexto de distâncias, sem objetos de posição inventada.','A hypothetical distant region shown only in a distance context, with no invented object positions.']
};
export const planets=planetRows.map(([id,pt,en,radiusKm,massKg,density,gravity,rotationDays,periodDays,tilt,temp,color,elements,rates],i)=>({id,names:{pt,en},type:i<4?'rocky':i<6?'gas':'ice',parent:'sun',radiusKm,massKg,density,gravity,rotationDays,periodDays,tilt,temp,color,elements,rates,aAU:elements[0],eccentricity:elements[1],model:'jpl',sources:['planets','elements'],appearance:'imagery',texture:id==='earth'?'earth_daymap':id==='venus'?'venus_atmosphere':id,knownMoons:[0,0,1,2,null,274,null,null][i],moonCountDate:'2025-03-11'}));
const moonRows=[
 ['moon','Lua','Moon','earth',1737.4,4902.8,384400,27.321661,.0549,5.145,'#c0c1c2'],
 ['phobos','Fobos','Phobos','mars',11.08,.0007087,9378,.31891,.0151,1.08,'#9a8c79'],
 ['deimos','Deimos','Deimos','mars',6.2,.0000962,23459,1.26244,.0002,1.79,'#afa092'],
 ['io','Io','Io','jupiter',1821.49,5959.91547,421800,1.76914,.0041,.05,'#d3bd63'],
 ['europa','Europa','Europa','jupiter',1560.8,3202.7121,671100,3.55118,.0094,.47,'#d9c7b0'],
 ['ganymede','Ganimedes','Ganymede','jupiter',2631.2,9887.83275,1070400,7.15455,.0013,.2,'#9d9182'],
 ['callisto','Calisto','Callisto','jupiter',2410.3,7179.2834,1882700,16.689,.0074,.19,'#7f7870'],
 ['titan','Titã','Titan','saturn',2574.76,8978.1371,1221870,15.9454,.0288,.35,'#cb9b54'],
 ['enceladus','Encélado','Enceladus','saturn',252.1,7.21037,238400,1.37022,.0047,.02,'#dce7e6'],
 ['miranda','Miranda','Miranda','uranus',235.8,4.3195,129900,1.41348,.0013,4.34,'#aca99f'],
 ['ariel','Ariel','Ariel','uranus',578.9,83.453,190900,2.52038,.0012,.04,'#c2c0b8'],
 ['umbriel','Umbriel','Umbriel','uranus',584.7,85.174,266000,4.14418,.0039,.13,'#797876'],
 ['titania','Titânia','Titania','uranus',788.9,226.943,436300,8.70587,.0011,.08,'#b1a99d'],
 ['oberon','Oberon','Oberon','uranus',761.4,205.324,583500,13.4632,.0014,.07,'#999188'],
 ['triton','Tritão','Triton','neptune',1352.6,1428.495,354800,-5.87685,.000016,156.865,'#c9c1b7'],
 ['charon','Caronte','Charon','pluto',606,105.88,19596,6.38723,.0002,.08,'#99958e']
];
const G_KM=6.67430e-20;
export const moons=moonRows.map(([id,pt,en,parent,radiusKm,gm,aKm,periodDays,eccentricity,inclination,color],i)=>({id,names:{pt,en},type:'moon',parent,radiusKm,massKg:gm/G_KM,density:(gm/G_KM)/(4/3*Math.PI*(radiusKm*1000)**3)/1000,gravity:gm*1e3/(radiusKm**2),rotationDays:periodDays,periodDays:Math.abs(periodDays),retrograde:periodDays<0,aKm,eccentricity,inclination,color,tilt:0,phase:i*47+31,model:'educational',appearance:id==='moon'?'imagery':'illustrative',texture:id==='moon'?'moon':null,sources:['moons','satelliteOrbits'],knownMoons:0}));
const dwarfRows=[
 ['pluto','Plutão','Pluto',1188.3,1.30246e22,39.482,.2488,17.14,247.92065*365.25,-6.3872,'#baa393'],
 ['ceres','Ceres','Ceres',469.7,9.38416e20,2.767,.0758,10.59,4.61*365.25,.37809,'#9f9a91'],
 ['eris','Éris','Eris',1200,1.66e22,67.864,.436,44.04,557.56*365.25,null,'#d2d3d0'],
 ['haumea','Haumea','Haumea',715,4.006e21,43.13,.195,28.2,284.81*365.25,.1631,'#b2b7ba'],
 ['makemake','Makemake','Makemake',714,3.1e21,45.79,.159,28.98,307.54*365.25,.937,'#ba9b85'],
 ['vesta','Vesta','Vesta',262.7,2.59076e20,2.362,.089,7.14,3.63*365.25,.2226,'#9c8a78']
];
export const smallBodies=dwarfRows.map(([id,pt,en,radiusKm,massKg,aAU,eccentricity,inclination,periodDays,rotationDays,color],i)=>({id,names:{pt,en},parent:'sun',type:id==='vesta'?'asteroid':'dwarf',radiusKm,massKg,aAU,eccentricity,inclination,periodDays,rotationDays,color,phase:55+i*43,tilt:id==='pluto'?122.5:0,density:radiusKm?massKg/(4/3*Math.PI*(radiusKm*1000)**3)/1000:null,gravity:radiusKm?6.67430e-11*massKg/(radiusKm*1000)**2:null,appearance:'illustrative',model:'educational',sources:['planets','small'],knownMoons:id==='pluto'?5:null,uncertain:id==='haumea'||id==='makemake'}));
const sun={id:'sun',names:{pt:'Sol',en:'Sun'},type:'star',parent:null,radiusKm:696340,massKg:1.9885e30,density:1.408,gravity:274,rotationDays:25.38,tilt:7.25,temp:5772,color:'#f7b66e',texture:'sun',sources:['system'],model:'origin',appearance:'imagery'};
const comet={id:'comet',names:{pt:'Cometa explorador',en:'Explorer comet'},type:'comet',parent:'sun',radiusKm:3,massKg:null,aAU:8,eccentricity:.78,inclination:25,periodDays:Math.sqrt(8**3)*365.25,rotationDays:.5,phase:7,color:'#9ac6ce',model:'hypothetical',appearance:'illustrative',sources:['comet']};
const regions=[['asteroidBelt','Cinturão de asteroides','Asteroid belt',2.7],['kuiperBelt','Cinturão de Kuiper','Kuiper belt',45],['oortCloud','Nuvem de Oort','Oort cloud',10000]].map(([id,pt,en,aAU])=>({id,names:{pt,en},type:'region',parent:'sun',aAU,color:'#647685',model:'schematic',appearance:'illustrative',sources:['system'],radiusKm:null}));
export const catalog=[sun,...planets,...moons,...smallBodies,comet,...regions].map(b=>({...b,description:{pt:descriptions[b.id][0],en:descriptions[b.id][1]}}));
export const byId=Object.assign(Object.create(null),Object.fromEntries(catalog.map(b=>[b.id,b])));
export const majorIds=['sun',...planets.map(b=>b.id),'moon'];
export const childrenOf=id=>catalog.filter(b=>b.parent===id&&b.type==='moon');
export const bodyName=(id,lang='pt')=>byId[id]?.names[lang]||id;
export const typeNames={pt:{star:'Estrela',rocky:'Planeta rochoso',gas:'Gigante gasoso',ice:'Gigante de gelo',moon:'Satélite natural',dwarf:'Planeta anão',asteroid:'Asteroide',comet:'Cometa hipotético',region:'Região esquemática'},en:{star:'Star',rocky:'Rocky planet',gas:'Gas giant',ice:'Ice giant',moon:'Natural satellite',dwarf:'Dwarf planet',asteroid:'Asteroid',comet:'Hypothetical comet',region:'Schematic region'}};
export const assetManifest=Object.fromEntries(['sun','mercury','venus_atmosphere','earth_daymap','earth_clouds','moon','mars','jupiter','saturn','uranus','neptune'].map(name=>[name,{path:`/textures/${name}.jpg`,resolution:'2048 × 1024',role:'sRGB color / enhanced planetary map',attribution:'Solar System Scope / INOVE, based on NASA data',license:'CC BY 4.0',url:SOURCES.textures.url,fallback:'Deterministic body-specific procedural material'}]));

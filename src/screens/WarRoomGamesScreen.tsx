import React, { useState } from 'react';
import { StyleSheet, View, TouchableOpacity, SafeAreaView, StatusBar, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { WebView } from 'react-native-webview';
import { useNavigation } from '@react-navigation/native';

// Mappatura: Memoria su rosso/montagne, Ingegno su viola/palazzi, Riflessi su ciano/città
const ZONES_DATA: Record<string, any> = {
  'nexus': { title: 'RIFLESSI', color: '#00E5FF', icon: 'flash', games: [{ id: 'GravityRunner', name: 'GRAVITY RUNNER' }, { id: 'ChuteTap', name: 'CHUTE TAP' }, { id: 'WallBounce', name: 'WALL BOUNCE' }, { id: 'Pong3D', name: 'CYBER PONG 3D' }, { id: 'ShapeSmist', name: 'SHAPE SMIST' }] },
  'vanguard': { title: 'MEMORIA', color: '#FF0055', icon: 'hardware-chip', games: [{ id: 'SimonDigital', name: 'SIMON DIGITAL' }, { id: 'StopTheClock', name: 'STOP THE CLOCK' }] },
  'void': { title: 'INGEGNO', color: '#B026FF', icon: 'extension-puzzle', games: [{ id: 'VisualCounter', name: 'VISUAL COUNTER' }, { id: 'Dominio15', name: 'DOMINIO 15' }, { id: 'TowerStack', name: 'TOWER STACK' }, { id: 'StroopTest', name: 'STROOP TEST' }] },
  'core': { title: 'MULTIPLAYER', color: '#39FF14', icon: 'globe', games: [{ id: 'PartyLobby', name: 'PARTY LOBBY' }] },
};

const MODIFIED_THREE_JS_MAP_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>3D Cyberpunk Holographic Map</title>
    <style>
        :root { --bg-dark: #050B14; --text-light: #E6F1FF; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: var(--bg-dark); color: var(--text-light); height: 100vh; overflow: hidden; display: flex; flex-direction: column; }
        #webgl-container { position: absolute; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 1; }
        .scanlines { position: absolute; top: 0; left: 0; width: 100vw; height: 100vh; background: linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,0) 50%, rgba(0,229,255,0.05) 50%, rgba(0,229,255,0.05)); background-size: 100% 4px; z-index: 2; pointer-events: none; }
        .vignette { position: absolute; top: 0; left: 0; width: 100vw; height: 100vh; background: radial-gradient(circle, rgba(0,0,0,0) 40%, rgba(5,11,20,1) 100%); z-index: 3; pointer-events: none; }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
</head>
<body>
    <div id="webgl-container"></div>
    <div class="scanlines"></div>
    <div class="vignette"></div>

    <script>
        const container = document.getElementById('webgl-container');
        const scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0x050B14, 0.015);

        const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.set(0, 40, 75);

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(renderer.domElement);

        const controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.maxPolarAngle = Math.PI / 2 - 0.05;
        controls.minDistance = 20;
        controls.maxDistance = 180;

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
        scene.add(ambientLight);
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(10, 50, 20);
        scene.add(dirLight);

        function getHoloMaterial(color, isWireframe = false) {
            return new THREE.MeshPhongMaterial({ color: 0x000000, emissive: color, emissiveIntensity: isWireframe ? 0.8 : 0.4, wireframe: isWireframe, transparent: true, opacity: isWireframe ? 0.8 : 0.6, flatShading: true, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
        }
        function getSolidMaterial(color) {
            return new THREE.MeshStandardMaterial({ color: color, emissive: color, emissiveIntensity: 0.2, flatShading: true, roughness: 0.8, metalness: 0.2 });
        }

        function createTextSprite(text, colorHex) {
            const canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 128;
            const ctx = canvas.getContext('2d');
            ctx.font = '900 48px sans-serif';
            ctx.fillStyle = colorHex;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = colorHex;
            ctx.shadowBlur = 10;
            ctx.fillText(text, 256, 64);
            
            const texture = new THREE.CanvasTexture(canvas);
            const material = new THREE.SpriteMaterial({ map: texture, transparent: true, blending: THREE.AdditiveBlending });
            const sprite = new THREE.Sprite(material);
            sprite.scale.set(18, 4.5, 1);
            return sprite;
        }

        const gridHelper = new THREE.GridHelper(200, 100, 0x00E5FF, 0x005577);
        gridHelper.position.y = -1.9;
        gridHelper.material.opacity = 0.2;
        gridHelper.material.transparent = true;
        scene.add(gridHelper);

        const islandGroup = new THREE.Group();
        scene.add(islandGroup);

        const sectors = [
            { id: 'nexus', name: 'Riflessi', color: 0x00E5FF, type: 'city', pos: {x: -8, z: -8} },
            { id: 'vanguard', name: 'Memoria', color: 0xFF0055, type: 'mountain', pos: {x: 8, z: -8} },
            { id: 'void', name: 'Ingegno', color: 0xB026FF, type: 'crater', pos: {x: -8, z: 8} },
            { id: 'core', name: 'Multiplayer', color: 0x39FF14, type: 'forest', pos: {x: 8, z: 8} }
        ];

        const interactiveMeshes = [];
        const originalMaterials = new Map();

        function addDecorations(group, type, color, numObjects, radius) {
            const mat = getHoloMaterial(color, true);
            const solidMat = getSolidMaterial(color);
            for (let i = 0; i < numObjects; i++) {
                const angle = Math.random() * Math.PI * 2;
                const dist = Math.random() * radius;
                const x = Math.cos(angle) * dist;
                const z = Math.sin(angle) * dist;
                let mesh;
                if (type === 'city') {
                    const height = Math.random() * 6 + 2;
                    mesh = new THREE.Mesh(new THREE.BoxGeometry(1.5, height, 1.5), Math.random() > 0.5 ? mat : solidMat);
                    mesh.position.set(x, height/2, z);
                } else if (type === 'mountain') {
                    const height = Math.random() * 8 + 4;
                    mesh = new THREE.Mesh(new THREE.ConeGeometry(Math.random() * 3 + 2, height, 4), mat);
                    mesh.position.set(x, height/2, z);
                } else if (type === 'crater') {
                    const size = Math.random() * 2 + 1;
                    mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(size, 0), mat);
                    mesh.position.set(x, size/2, z);
                    mesh.rotation.set(Math.random(), Math.random(), Math.random());
                } else if (type === 'forest') {
                    const treeGroup = new THREE.Group();
                    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.4, 1.5, 5), getSolidMaterial(0x555555));
                    trunk.position.y = 0.75;
                    const leaves = new THREE.Mesh(new THREE.ConeGeometry(1.5, 3, 5), mat);
                    leaves.position.y = 2.5;
                    treeGroup.add(trunk); treeGroup.add(leaves);
                    treeGroup.position.set(x, 0, z);
                    mesh = treeGroup;
                }
                if(mesh) group.add(mesh);
            }
        }

        sectors.forEach(sector => {
            const sectorGroup = new THREE.Group();
            sectorGroup.position.set(sector.pos.x, 0, sector.pos.z);
            
            const baseMat = getSolidMaterial(sector.color);
            baseMat.transparent = true; baseMat.opacity = 0.4;
            const baseMesh = new THREE.Mesh(new THREE.CylinderGeometry(10, 12, 4, 6), baseMat);
            baseMesh.position.y = -0.5;
            baseMesh.userData = { id: sector.id, name: sector.name, color: sector.color, type: 'zone' };
            
            interactiveMeshes.push(baseMesh);
            originalMaterials.set(baseMesh.uuid, baseMat.clone());
            sectorGroup.add(baseMesh);
            addDecorations(sectorGroup, sector.type, sector.color, 15, 8);
            islandGroup.add(sectorGroup);
        });

        // Pianeta CLASSIFICA
        const rankPlanetMat = getHoloMaterial(0xFFD700, true);
        const rankPlanet = new THREE.Mesh(new THREE.IcosahedronGeometry(3, 1), rankPlanetMat);
        rankPlanet.position.set(-25, 12, -5);
        rankPlanet.userData = { id: 'Arcade', type: 'nav', name: 'CLASSIFICA', color: 0xFFD700 };
        interactiveMeshes.push(rankPlanet);
        originalMaterials.set(rankPlanet.uuid, rankPlanetMat.clone());
        const rankLabel = createTextSprite('CLASSIFICA', '#FFD700');
        rankLabel.position.set(0, 5, 0);
        rankPlanet.add(rankLabel);
        scene.add(rankPlanet);

        // Pianeta HOLONET
        const holoPlanetMat = getHoloMaterial(0x00E5FF, true);
        const holoPlanet = new THREE.Mesh(new THREE.IcosahedronGeometry(3, 1), holoPlanetMat);
        holoPlanet.position.set(25, 12, -5);
        holoPlanet.userData = { id: 'Holonet', type: 'nav', name: 'HOLONET', color: 0x00E5FF };
        interactiveMeshes.push(holoPlanet);
        originalMaterials.set(holoPlanet.uuid, holoPlanetMat.clone());
        const holoLabel = createTextSprite('HOLONET', '#00E5FF');
        holoLabel.position.set(0, 5, 0);
        holoPlanet.add(holoLabel);
        scene.add(holoPlanet);

        // SATELLITE 3D FLUTTUANTE (STANZE PRIVATE / GAME ROOM) AL CENTRO
        const roomSatelliteGroup = new THREE.Group();
        roomSatelliteGroup.position.set(0, 16, 0);
        scene.add(roomSatelliteGroup);

        const satMat = getHoloMaterial(0x00E5FF, true);
        const satCore = new THREE.Mesh(new THREE.IcosahedronGeometry(3, 1), satMat);
        const satRing = new THREE.Mesh(new THREE.TorusGeometry(5, 0.25, 8, 24), satMat);
        satRing.rotation.x = Math.PI / 2;
        roomSatelliteGroup.add(satCore);
        roomSatelliteGroup.add(satRing);

        const satLabel = createTextSprite('GAME ROOM', '#00E5FF');
        satLabel.position.set(0, 6, 0);
        roomSatelliteGroup.add(satLabel);

        satCore.userData = { id: 'RoomHub', type: 'room_satellite', name: 'GAME ROOM', color: 0x00E5FF };
        satRing.userData = { id: 'RoomHub', type: 'room_satellite', name: 'GAME ROOM', color: 0x00E5FF };
        interactiveMeshes.push(satCore);
        interactiveMeshes.push(satRing);
        originalMaterials.set(satCore.uuid, satMat.clone());
        originalMaterials.set(satRing.uuid, satMat.clone());

        // Particelle
        const particleGeo = new THREE.BufferGeometry();
        const posArray = new Float32Array(300 * 3);
        for(let i=0; i<900; i+=3) {
            posArray[i] = (Math.random() - 0.5) * 80;
            posArray[i+1] = Math.random() * 40;
            posArray[i+2] = (Math.random() - 0.5) * 80;
        }
        particleGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
        scene.add(new THREE.Points(particleGeo, new THREE.PointsMaterial({ size: 0.2, color: 0x00E5FF, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending })));

        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();
        let selectedMesh = null;

        function onClick(event) {
            let clientX = event.changedTouches ? event.changedTouches[0].clientX : event.clientX;
            let clientY = event.changedTouches ? event.changedTouches[0].clientY : event.clientY;
            mouse.x = (clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(clientY / window.innerHeight) * 2 + 1;

            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObjects(interactiveMeshes);

            if (selectedMesh) selectedMesh.material = originalMaterials.get(selectedMesh.uuid);

            if (intersects.length > 0) {
                selectedMesh = intersects[0].object;
                const data = selectedMesh.userData;

                selectedMesh.material = getHoloMaterial(data.color, false);
                selectedMesh.material.opacity = 0.9;
                selectedMesh.material.emissiveIntensity = 0.9;

                if (window.ReactNativeWebView) {
                    if (data.type === 'zone') {
                        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ZONE_SELECT', zoneId: data.id }));
                    } else if (data.type === 'nav') {
                        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'NAVIGATE', route: data.id }));
                    } else if (data.type === 'room_satellite') {
                        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'SATELLITE_ROOM_TAP' }));
                    }
                }
            } else {
                selectedMesh = null;
                if (window.ReactNativeWebView) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ZONE_DESELECT' }));
                }
            }
        }

        window.addEventListener('click', onClick);
        window.addEventListener('touchstart', (e) => { window.touchStartX = e.touches[0].clientX; window.touchStartY = e.touches[0].clientY; }, {passive: true});
        window.addEventListener('touchend', (e) => {
            if (Math.abs(e.changedTouches[0].clientX - window.touchStartX) < 10 && Math.abs(e.changedTouches[0].clientY - window.touchStartY) < 10) onClick(e);
        });

        const clock = new THREE.Clock();
        function animate() {
            requestAnimationFrame(animate);
            const elapsedTime = clock.getElapsedTime();
            controls.update();
            
            islandGroup.rotation.y = elapsedTime * 0.05;

            rankPlanet.rotation.y += 0.01;
            rankPlanet.rotation.x += 0.005;
            rankPlanet.position.y = 12 + Math.sin(elapsedTime * 1.5) * 0.5;

            holoPlanet.rotation.y -= 0.01;
            holoPlanet.rotation.x += 0.005;
            holoPlanet.position.y = 12 + Math.cos(elapsedTime * 1.5) * 0.5;
            
            // Animazione Satellite Stanza Centrale
            roomSatelliteGroup.position.y = 16 + Math.sin(elapsedTime * 2.5) * 1.2;
            satCore.rotation.y += 0.02;
            satCore.rotation.x += 0.01;
            satRing.rotation.z -= 0.03;

            gridHelper.position.x = (elapsedTime * 2) % 10;
            gridHelper.position.z = (elapsedTime * 2) % 10;
            renderer.render(scene, camera);
        }
        window.addEventListener('resize', () => { camera.aspect = window.innerWidth/window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });
        animate();
    </script>
</body>
</html>
`;

export default function WarRoomGamesScreen() {
  const navigation = useNavigation<any>();
  const [activeZoneId, setActiveZoneId] = useState<string | null>(null);

  const activeZoneData = activeZoneId ? ZONES_DATA[activeZoneId] : null;

  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'ZONE_SELECT' && data.zoneId) {
        setActiveZoneId(data.zoneId);
      } else if (data.type === 'ZONE_DESELECT') {
        setActiveZoneId(null);
      } else if (data.type === 'NAVIGATE' && data.route) {
        setActiveZoneId(null);
        navigation.navigate(data.route);
      } else if (data.type === 'SATELLITE_ROOM_TAP') {
        setActiveZoneId(null);
        navigation.navigate('RoomHub');
      }
    } catch (err) {
      console.log('Errore parsing messaggio webview:', err);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.container}>
        <WebView
          source={{ html: MODIFIED_THREE_JS_MAP_HTML }}
          style={styles.webView}
          scrollEnabled={false}
          androidLayerType="hardware"
          onMessage={handleWebViewMessage}
        />

        <View style={styles.headerAbsolute} pointerEvents="box-none">
          <BlurView intensity={80} tint="dark" style={styles.headerBlur}>
            <TouchableOpacity 
              style={styles.backButton} 
              onPress={() => navigation.goBack()}
              hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={24} color="#00E5FF" />
            </TouchableOpacity>
            
            <View style={styles.headerCenter}>
              <Text style={styles.headerTag}>HUB ARCADE // TATTICO</Text>
              <Text style={styles.headerTitle}>GAME ROOM</Text>
            </View>
            
            <View style={{ width: 40 }} /> 
          </BlurView>
        </View>

        {activeZoneData && (
          <View style={styles.holoMenuWrapper} pointerEvents="box-none">
            <BlurView intensity={90} tint="dark" style={[styles.holoMenu, { borderColor: activeZoneData.color }]}>
              
              <View style={[styles.holoMenuHeader, { backgroundColor: `${activeZoneData.color}20` }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name={activeZoneData.icon as any} size={24} color={activeZoneData.color} style={{ marginRight: 10 }} />
                  <Text style={[styles.holoMenuTitle, { color: activeZoneData.color }]}>
                    {activeZoneData.title}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setActiveZoneId(null)} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
                  <Ionicons name="close-circle" size={28} color={activeZoneData.color} />
                </TouchableOpacity>
              </View>

              <View style={styles.holoMenuList}>
                <Text style={styles.instructionText}>Seleziona una simulazione per iniziare il test neurale (Modalità Allenamento).</Text>
                {activeZoneData.games.map((game: any) => (
                  <TouchableOpacity 
                    key={game.id}
                    style={styles.gameItem}
                    onPress={() => navigation.navigate(game.id)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="play-outline" size={20} color="#E6F1FF" />
                    <Text style={styles.gameItemText}>{game.name}</Text>
                    <Ionicons name="chevron-forward" size={16} color={activeZoneData.color} />
                  </TouchableOpacity>
                ))}
              </View>
            </BlurView>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#050B14' },
  container: { flex: 1, position: 'relative' },
  webView: { flex: 1, backgroundColor: '#050B14' },
  headerAbsolute: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50 },
  headerBlur: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(0, 229, 255, 0.2)' },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0, 229, 255, 0.1)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(0, 229, 255, 0.3)' },
  headerCenter: { alignItems: 'center' },
  headerTag: { color: '#00E5FF', fontSize: 9, fontWeight: '900', letterSpacing: 1.5, marginBottom: 2 },
  headerTitle: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 1 },
  holoMenuWrapper: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, paddingBottom: 40, justifyContent: 'flex-end', zIndex: 100 },
  holoMenu: { width: '100%', borderRadius: 20, borderWidth: 1, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.8, shadowRadius: 20, shadowOffset: { width: 0, height: 10 } },
  holoMenuHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  holoMenuTitle: { fontSize: 16, fontWeight: '900', letterSpacing: 1.5 },
  holoMenuList: { padding: 16, backgroundColor: 'rgba(10, 25, 47, 0.85)' },
  instructionText: { color: '#8892B0', fontSize: 12, marginBottom: 16, fontStyle: 'italic' },
  gameItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', padding: 16, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  gameItemText: { flex: 1, color: '#E6F1FF', fontSize: 14, fontWeight: 'bold', marginLeft: 12, letterSpacing: 1 },
});

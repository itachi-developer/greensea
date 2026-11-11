import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, StatusBar, Image, ActivityIndicator, ScrollView, Animated, TextInput, KeyboardAvoidingView, Platform, Keyboard, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { supabase } from '../lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { BlurView } from 'expo-blur';
import { WebView } from 'react-native-webview';

export default function ProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [totalEnergy, setTotalEnergy] = useState(0);
  const [gamesPlayed, setGamesPlayed] = useState(0);
  const [history, setHistory] = useState<any[]>([]);
  const [trophies, setTrophies] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [historyVisible, setHistoryVisible] = useState(false);

  // Stato Profilo
  const [isOverlayVisible, setIsOverlayVisible] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));

  // Stato Daily Prompt e Animazioni
  const [dailyPrompt, setDailyPrompt] = useState<any>(null);
  const [hasAnsweredToday, setHasAnsweredToday] = useState(false);
  const [myTodayResponse, setMyTodayResponse] = useState<string>(''); 
  const [isPromptOverlayVisible, setIsPromptOverlayVisible] = useState(false);
  const [promptFadeAnim] = useState(new Animated.Value(0));
  
  const [userResponse, setUserResponse] = useState('');
  const [submittingResponse, setSubmittingResponse] = useState(false);
  const [reputation, setReputation] = useState(0);

  const holoColor = '#39FF14'; 

  useEffect(() => {
    fetchProfileData();
  }, []);

  const fetchProfileData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // 1. Profilo Base
      let { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      
      if (!profileData || !profileData.username) {
        const updates = {
          id: user.id,
          username: user.email?.split('@')[0] || 'Utente'
        };
        await supabase.from('profiles').upsert(updates, { onConflict: 'id' });
        setProfile(updates);
      } else {
        setProfile(profileData);
      }

      // 2. Statistiche Arcade (Personal Bests da user_best_scores)
      const { data: bestScoresData } = await supabase.from('user_best_scores').select('*').eq('user_id', user.id).order('highest_score', { ascending: false });
      if (bestScoresData) {
        setGamesPlayed(bestScoresData.length);
        setTotalEnergy(bestScoresData.reduce((acc, curr) => acc + (curr.highest_score || 0), 0));
        setHistory(bestScoresData);
      }

      // 3. Trofei
      const { data: userTrophiesData } = await supabase.from('user_trophies').select('trophy_id').eq('user_id', user.id);
      if (userTrophiesData && userTrophiesData.length > 0) {
        const { data: resolvedTrophies } = await supabase.from('trophies').select('*').in('id', userTrophiesData.map((t: any) => t.trophy_id));
        if (resolvedTrophies) setTrophies(resolvedTrophies);
      }

      // 4. Logica Daily Prompt e Reputazione
      await checkDailyPrompt(user.id);
      await fetchReputation(user.id);

    } catch (error) {
      console.error('Errore caricamento profilo:', error);
      Alert.alert("Errore", "Impossibile caricare il profilo utente. Riprova più tardi.");
    } finally {
      setLoading(false);
    }
  };

  const checkDailyPrompt = async (userId: string) => {
    try {
      const { data: promptData, error: promptError } = await supabase
        .from('daily_prompts')
        .select('*')
        .order('published_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (promptError) alert("ERRORE LETTURA PROMPT: " + promptError.message);

      if (promptData && !promptError) {
        setDailyPrompt(promptData);

        const { data: existingResponse, error: responseError } = await supabase
          .from('social_posts')
          .select('id, content')
          .eq('user_id', userId)
          .eq('prompt_id', promptData.id)
          .maybeSingle();

        if (responseError) alert("ERRORE LETTURA POST: " + responseError.message);

        if (existingResponse) {
           setHasAnsweredToday(true);
           setMyTodayResponse(existingResponse.content);
        } else {
           setHasAnsweredToday(false);
           setMyTodayResponse('');
        }
      } else {
         setDailyPrompt(null);
         setHasAnsweredToday(true);
      }
    } catch (error: any) {
       alert("ERRORE CRITICO CHECK: " + error.message);
       setDailyPrompt(null);
       setHasAnsweredToday(true); 
    }
  };

  const fetchReputation = async (userId: string) => {
     try {
       const { data, error } = await supabase
         .from('social_posts')
         .select('likes_count, upvotes')
         .eq('user_id', userId);
         
       if (error) throw error;
       const totalKarma = data?.reduce((sum, post) => sum + (post.likes_count || post.upvotes || 0), 0) || 0;
       setReputation(totalKarma);
     } catch (error) {
         console.error("Errore fetchReputation:", error);
     }
  };

  const handlePickAndUploadAvatar = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) return alert('Permesso richiesto.');

      const result = await ImagePicker.launchImageLibraryAsync({ 
        mediaTypes: ImagePicker.MediaTypeOptions.Images, 
        allowsEditing: true, 
        aspect: [1, 1], 
        quality: 0.5,
        base64: true 
      });
      
      if (result.canceled || !result.assets) return;

      setUploading(true);
      const asset = result.assets[0];
      const uri = asset.uri;
      const base64 = asset.base64;
      
      if (!base64) {
        throw new Error("Impossibile leggere i dati dell'immagine.");
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setUploading(false); return; }

      const isPng = uri.toLowerCase().endsWith('png');
      const ext = isPng ? 'png' : 'jpg';
      const mimeType = isPng ? 'image/png' : 'image/jpeg';
      const fileName = `avatar_${user.id}_${Date.now()}.${ext}`;

      // CONVERSIONE BASE64 -> UINT8ARRAY (BINARIO PURO NATIVO)
      const binaryString = atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Upload del buffer binario su Supabase
      const { error } = await supabase.storage.from('avatars').upload(fileName, bytes.buffer, { 
        upsert: true,
        contentType: mimeType, 
        cacheControl: '3600'
      });
      
      if (error) throw error;
      
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
      
      await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id);
      
      setProfile((prev: any) => ({ ...prev, avatar_url: publicUrl }));
      alert('Foto profilo aggiornata con successo!');
    } catch (e: any) {
      console.error("Upload error: ", e);
      alert("Errore upload: " + (e.message || "Impossibile caricare l'immagine."));
    } finally {
      setUploading(false);
    }
  };
  
  const toggleOverlay = () => {
    if (isOverlayVisible) {
      Animated.timing(fadeAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => setIsOverlayVisible(false));
    } else {
      setIsOverlayVisible(true);
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    }
  };

  const togglePromptOverlay = () => {
    if (!dailyPrompt) {
      alert("Nessuna trasmissione trovata in memoria. Il database non ha inviato la storia all'app.");
      return;
    }
    
    if (isPromptOverlayVisible) {
      Keyboard.dismiss();
      Animated.timing(promptFadeAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => setIsPromptOverlayVisible(false));
    } else {
      setIsPromptOverlayVisible(true);
      Animated.timing(promptFadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    }
  };

  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'AVATAR_TAP') {
        toggleOverlay(); 
      } else if (data.type === 'SATELLITE_TAP') {
        togglePromptOverlay(); 
      } else if (data.type === 'TURBINE_TAP') {
        navigation.navigate('Turbine' as never); 
      }
    } catch (err) {
      console.log('Errore parsing messaggio webview:', err);
    }
  };

  const submitDailyResponse = async () => {
    if (!userResponse.trim() || !dailyPrompt || !profile) return;
    setSubmittingResponse(true);

    try {
        const { error } = await supabase.from('social_posts').insert({
            user_id: profile.id,
            content: userResponse.trim(),
            prompt_id: dailyPrompt.id,
            is_daily_story: true
        });

        if (error) throw error;

        setMyTodayResponse(userResponse.trim());
        setHasAnsweredToday(true);
        setUserResponse('');
        alert("Trasmissione completata. La tua mossa è sull'Holonet.");
    } catch (error) {
        console.error("Errore submitDailyResponse:", error);
        alert("Errore durante la trasmissione.");
    } finally {
        setSubmittingResponse(false);
    }
  };

  if (loading) return <SafeAreaView style={styles.safeArea}><ActivityIndicator size="large" color={holoColor} /></SafeAreaView>;

  const username = profile?.username || 'Utente';
  const avatarInitial = username.charAt(0).toUpperCase();

  const generateThreeJSCannabis = (color: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <style>
        body, html { margin: 0; padding: 0; width: 100%; height: 100%; background-color: #050B14; overflow: hidden; touch-action: none; }
        #canvas-container { width: 100%; height: 100%; }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
</head>
<body>
    <div id="canvas-container"></div>
    <script>
        const color = '${color}'.replace('#', '0x');
        const hexColor = parseInt(color, 16);

        const scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0x050B14, 0.025);
        
        const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.set(0, 5, 45); 

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        document.getElementById('canvas-container').appendChild(renderer.domElement);

        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();

        const controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.enablePan = false;
        controls.minDistance = 20;
        controls.maxDistance = 100;

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
        scene.add(ambientLight);
        
        const pointLight = new THREE.PointLight(hexColor, 3, 60);
        pointLight.position.set(0, 10, 10);
        scene.add(pointLight);
        
        const rimLight = new THREE.DirectionalLight(0xffffff, 0.5);
        rimLight.position.set(-10, 20, -20);
        scene.add(rimLight);

        // MATERIALI BASE
        const stemMat = new THREE.MeshPhongMaterial({ color: 0x000000, emissive: hexColor, emissiveIntensity: 0.5, wireframe: true, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending });
        const leafMat = new THREE.MeshPhongMaterial({ color: 0x000000, emissive: hexColor, emissiveIntensity: 0.8, wireframe: false, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
        const budMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: hexColor, emissiveIntensity: 1.2, roughness: 0.2, metalness: 0.8, wireframe: true, transparent: true, opacity: 0.9 });

        // 1. GRUPPO PIANTA (Centro)
        const avatarGroup = new THREE.Group();
        const trunkGeo = new THREE.CylinderGeometry(0.3, 0.7, 14, 8);
        const trunk = new THREE.Mesh(trunkGeo, stemMat);
        trunk.position.y = 7;
        avatarGroup.add(trunk);

        function createCannabisLeaf(scale) {
            const leafGroup = new THREE.Group();
            const shape = new THREE.Shape();
            shape.moveTo(0, 0);
            shape.quadraticCurveTo(0.2, 1.5, 0, 4);
            shape.quadraticCurveTo(-0.2, 1.5, 0, 0);

            const extrudeSettings = { depth: 0.05, bevelEnabled: false };
            const leafletGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
            leafletGeo.translate(0, 0.5, 0);

            const numLeaflets = 7;
            const angles = [-1.1, -0.7, -0.3, 0, 0.3, 0.7, 1.1];
            const scales = [0.4, 0.7, 1.0, 1.2, 1.0, 0.7, 0.4];

            for(let j = 0; j < numLeaflets; j++) {
                const leaflet = new THREE.Mesh(leafletGeo, leafMat);
                leaflet.rotation.z = angles[j];
                leaflet.scale.set(scales[j], scales[j], scales[j]);
                leaflet.rotation.x = 0.2; 
                leafGroup.add(leaflet);
            }
            leafGroup.scale.set(scale, scale, scale);
            return leafGroup;
        }

        const numBranches = 28; 
        for(let i = 0; i < numBranches; i++) {
            const h = (i / numBranches) * 12 + 1; 
            const angle = i * Math.PI * 1.618; 
            
            const branchGroup = new THREE.Group();
            branchGroup.position.set(0, h, 0);
            branchGroup.rotation.y = angle;
            
            const branchLength = 5.5 - (i * 0.15); 
            const branchGeo = new THREE.CylinderGeometry(0.08, 0.15, branchLength, 4);
            const branch = new THREE.Mesh(branchGeo, stemMat);
            branch.rotation.z = Math.PI / 2;
            branch.position.x = branchLength / 2;
            branchGroup.add(branch);

            const leaf = createCannabisLeaf(0.5 - (i * 0.012));
            leaf.position.set(branchLength, 0, 0);
            leaf.rotation.z = -Math.PI / 2;
            leaf.rotation.x = Math.PI / 2;
            leaf.rotation.y = 0.2 + (Math.random() * 0.3); 
            branchGroup.add(leaf);
            
            if (i > 10 && i % 2 === 0) {
                const smallBudGroup = new THREE.Group();
                for(let b = 0; b < 6; b++) {
                    const sbGeo = new THREE.DodecahedronGeometry(0.25 + Math.random()*0.15, 1);
                    const pos = sbGeo.attributes.position;
                    for(let v = 0; v < pos.count; v++) {
                        pos.setXYZ(v, pos.getX(v)*(1+Math.random()*0.2), pos.getY(v)*(1+Math.random()*0.2), pos.getZ(v)*(1+Math.random()*0.2));
                    }
                    sbGeo.computeVertexNormals();
                    const sbMesh = new THREE.Mesh(sbGeo, budMat);
                    sbMesh.position.set((Math.random()-0.5)*0.5, Math.random()*0.4, (Math.random()-0.5)*0.5);
                    smallBudGroup.add(sbMesh);
                }
                smallBudGroup.position.set(branchLength * (0.4 + Math.random()*0.3), 0.2, 0);
                branchGroup.add(smallBudGroup);
            }
            avatarGroup.add(branchGroup);
        }

        const colaGroup = new THREE.Group();
        colaGroup.position.y = 13.5; 
        
        for(let k = 0; k < 25; k++) {
            const budSize = 0.65 - (k * 0.025); 
            const budH = k * 0.24; 
            const subBudGeo = new THREE.DodecahedronGeometry(budSize, 1);
            
            const positions = subBudGeo.attributes.position;
            for(let v = 0; v < positions.count; v++) {
                positions.setXYZ(v, positions.getX(v)*(1+Math.random()*0.2), positions.getY(v)*(1+Math.random()*0.2), positions.getZ(v)*(1+Math.random()*0.2));
            }
            subBudGeo.computeVertexNormals();

            const subBud = new THREE.Mesh(subBudGeo, budMat);
            const rad = (1 - (k/25)) * 0.7;
            const ang = k * Math.PI * 0.8;
            subBud.position.set(Math.cos(ang)*rad, budH, Math.sin(ang)*rad);
            colaGroup.add(subBud);
        }
        avatarGroup.add(colaGroup);
        avatarGroup.position.y = -8.5;
        scene.add(avatarGroup);

        // 2. GRUPPO SATELLITE (Destra)
        const satelliteGroup = new THREE.Group();
        const hitBoxGeo = new THREE.SphereGeometry(4, 16, 16);
        const hitBoxMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
        const satHitBox = new THREE.Mesh(hitBoxGeo, hitBoxMat);
        satelliteGroup.add(satHitBox);
        
        const satCoreGeo = new THREE.OctahedronGeometry(1.5, 0);
        const satCoreMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: hexColor, emissiveIntensity: 1.5, wireframe: true, transparent: true, opacity: 0.9 });
        const satCore = new THREE.Mesh(satCoreGeo, satCoreMat);
        satelliteGroup.add(satCore);

        const satRingGeo = new THREE.TorusGeometry(2.5, 0.05, 16, 100);
        const satRing = new THREE.Mesh(satRingGeo, stemMat);
        satRing.rotation.x = Math.PI / 2;
        satelliteGroup.add(satRing);

        satelliteGroup.position.set(8, 12, 5);
        scene.add(satelliteGroup);

        // 3. GRUPPO TURBINA (Sinistra)
        const turbineGroup = new THREE.Group();
        const turbHitBox = new THREE.Mesh(hitBoxGeo, hitBoxMat); 
        turbineGroup.add(turbHitBox);

        // Ruota centrale
        const turbWheelGeo = new THREE.TorusGeometry(1.5, 0.3, 16, 12);
        const turbWheelMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xFFD700, emissiveIntensity: 1.2, wireframe: true, transparent: true, opacity: 0.9 });
        const turbWheel = new THREE.Mesh(turbWheelGeo, turbWheelMat);
        turbineGroup.add(turbWheel);
        
        // Perno centrale
        const turbCoreGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 8);
        const turbCoreMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xFFD700, emissiveIntensity: 0.5 });
        const turbCore = new THREE.Mesh(turbCoreGeo, turbCoreMat);
        turbCore.rotation.x = Math.PI / 2;
        turbineGroup.add(turbCore);

        // Anello decorativo esterno
        const turbRingGeo = new THREE.TorusGeometry(2.5, 0.05, 16, 64);
        const turbRingMat = new THREE.MeshPhongMaterial({ color: 0x000000, emissive: 0xFFD700, emissiveIntensity: 0.5, transparent: true, opacity: 0.6 });
        const turbRing = new THREE.Mesh(turbRingGeo, turbRingMat);
        turbineGroup.add(turbRing);

        turbineGroup.position.set(-8, 12, 5);
        scene.add(turbineGroup);

        // Particelle di sfondo
        const particleGeo = new THREE.BufferGeometry();
        const posArray = new Float32Array(450);
        for(let i=0; i<450; i++) {
            posArray[i] = (Math.random() - 0.5) * 30; 
            posArray[i+1] = (Math.random() - 0.5) * 30; 
            posArray[i+2] = (Math.random() - 0.5) * 30; 
        }
        particleGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
        const particleMat = new THREE.PointsMaterial({ size: 0.15, color: 0xffffff, transparent: true, opacity: 0.8 });
        const particles = new THREE.Points(particleGeo, particleMat);
        scene.add(particles);

        let touchStartX = 0, touchStartY = 0;
        let touchStartTime = 0;

        window.addEventListener('touchstart', (e) => { 
            touchStartTime = Date.now(); 
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        });

        window.addEventListener('touchend', (e) => {
            let touchEndX = e.changedTouches[0].clientX;
            let touchEndY = e.changedTouches[0].clientY;
            
            if (Date.now() - touchStartTime < 250 && Math.abs(touchEndX - touchStartX) < 15 && Math.abs(touchEndY - touchStartY) < 15) {
                mouse.x = (touchEndX / window.innerWidth) * 2 - 1;
                mouse.y = -(touchEndY / window.innerHeight) * 2 + 1;
                
                raycaster.setFromCamera(mouse, camera);

                // Controllo Turbina (Sinistra)
                if (raycaster.intersectObject(turbineGroup, true).length > 0) {
                    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'TURBINE_TAP' }));
                    return;
                }

                // Controllo Satellite (Destra)
                if (raycaster.intersectObject(satelliteGroup, true).length > 0) {
                    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'SATELLITE_TAP' }));
                    return;
                }

                // Controllo Pianta (Centro)
                if (raycaster.intersectObject(avatarGroup, true).length > 0) {
                    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'AVATAR_TAP' }));
                }
            }
        });

        const clock = new THREE.Clock();
        function animate() {
            requestAnimationFrame(animate);
            const time = clock.getElapsedTime();
            controls.update();

            // Animazione Pianta
            avatarGroup.position.y = -8.5 + Math.sin(time * 1.5) * 0.4;
            avatarGroup.rotation.y = time * 0.15; 
            
            // Animazione Satellite
            satelliteGroup.position.y = 12 + Math.sin(time * 2) * 1.2;
            satCore.rotation.x = time * 0.8;
            satCore.rotation.y = time * 0.5;
            satRing.rotation.z = -time * 0.4;
            satRing.rotation.y = Math.sin(time * 0.5) * 0.5;

            // Animazione Turbina
            turbineGroup.position.y = 12 + Math.cos(time * 2) * 1.2;
            turbWheel.rotation.z = -time * 1.5;
            turbCore.rotation.z = -time * 1.5;
            turbRing.rotation.x = time * 0.6;
            turbRing.rotation.y = Math.sin(time * 0.5) * 0.5;

            particles.rotation.y = time * 0.05;

            renderer.render(scene, camera);
        }
        animate();

        window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        });
    </script>
</body>
</html>
`;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.dashboardContainer}>
        
        <WebView 
          source={{ html: generateThreeJSCannabis(holoColor) }} 
          style={styles.webviewFullscreen} 
          scrollEnabled={false} 
          onMessage={handleWebViewMessage}
        />
        
        <View style={styles.greetingContainer} pointerEvents="none">
          <Text style={[styles.greetingText, { color: holoColor, textShadowColor: holoColor }]}>
            BENTORNATO SU GREENSEA, {username.toUpperCase()}.
          </Text>
          <Text style={[styles.greetingSub, { color: holoColor }]}>
            SISTEMI NEURALI A TUA DISPOSIZIONE
          </Text>
        </View>
        
        <Text style={styles.instructionText}>
            Tocca la pianta per i dati neurali. 
            {"\n"}Tocca il satellite per l'Holonet. Tocca la turbina per il Bonus.
        </Text>

        <View style={styles.hubButtonsAbsolute}>
          <TouchableOpacity style={[styles.hubButton, { borderColor: holoColor }]} onPress={() => navigation.navigate('Chat')} activeOpacity={0.85}>
            <LinearGradient colors={[`${holoColor}30`, '#050B14']} style={styles.hubGradient}>
              <Ionicons name="chatbubbles" size={24} color={holoColor} />
              <Text style={[styles.hubButtonTitle, { color: holoColor }]}>COMUNICAZIONE</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.hubButton, { borderColor: '#FF0055' }]} onPress={() => navigation.navigate('WarRoomGames')} activeOpacity={0.85}>
            <LinearGradient colors={['rgba(255, 0, 85, 0.3)', '#050B14']} style={styles.hubGradient}>
              <Ionicons name="game-controller" size={24} color="#FF0055" />
              <Text style={[styles.hubButtonTitle, { color: '#FF0055' }]}>GAME ROOM</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* OVERLAY PROFILO (Menu Classico) */}
        {isOverlayVisible && (
          <Animated.View style={[styles.overlayContainer, { opacity: fadeAnim }]}>
            <BlurView intensity={90} tint="dark" style={[styles.overlayBlur, { borderColor: holoColor }]}>
              
              <View style={styles.overlayHeader}>
                <Text style={[styles.overlayTitle, { color: holoColor }]}>DATI NEURALI AGENTE</Text>
                <TouchableOpacity onPress={toggleOverlay}>
                  <Ionicons name="close-circle" size={32} color={holoColor} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.overlayScroll}>
                
                <View style={styles.statsCard}>
                  <View style={styles.avatarMiniRow}>
                    <TouchableOpacity onPress={handlePickAndUploadAvatar} activeOpacity={0.8}>
                      {profile?.avatar_url ? (
                        <Image 
                          key={profile.avatar_url} 
                          source={{ uri: profile.avatar_url + '?t=' + new Date().getTime() }} 
                          style={[styles.avatarMini, { borderColor: holoColor }]} 
                        />
                      ) : (
                        <View style={[styles.avatarMiniTextContainer, { borderColor: holoColor }]}>
                          <Text style={[styles.avatarMiniText, { color: holoColor }]}>{avatarInitial}</Text>
                        </View>
                      )}
                      <View style={styles.cameraIconBadge}><Ionicons name="camera" size={10} color="#050B14" /></View>
                    </TouchableOpacity>
                    <View style={{ flex: 1, marginLeft: 14 }}>
                      <Text style={styles.nicknameHeader}>{username.toUpperCase()}</Text>
                    </View>
                    <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={[styles.settingsBtn, { borderColor: holoColor }]}>
                      <Ionicons name="settings" size={20} color={holoColor} />
                    </TouchableOpacity>
                  </View>
                  
                  <View style={styles.resourceRow}>
                    <View style={styles.resourceBox}>
                      <Ionicons name="flash" size={16} color={holoColor} />
                      <Text style={styles.resourceValue}>{totalEnergy} <Text style={styles.resourceUnit}>ENERGIA</Text></Text>
                    </View>
                    <View style={styles.resourceDivider} />
                    <View style={styles.resourceBox}>
                      <Ionicons name="trophy" size={16} color="#FFD700" />
                      <Text style={styles.resourceValue}>{trophies.length} <Text style={styles.resourceUnit}>TROFEI</Text></Text>
                    </View>
                     <View style={styles.resourceDivider} />
                    <View style={styles.resourceBox}>
                      <Ionicons name="heart" size={16} color="#FF0055" />
                      <Text style={styles.resourceValue}>{reputation} <Text style={styles.resourceUnit}>KARMA</Text></Text>
                    </View>
                  </View>
                </View>

                <Text style={[styles.sectionTitle, { color: holoColor }]}>VETRINA TROFEI</Text>
                {trophies.length === 0 ? (
                  <Text style={styles.emptyText}>Nessun trofeo sbloccato nelle simulazioni.</Text>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trophiesScroll}>
                    {trophies.map(t => (
                      <View key={t.id} style={[styles.trophyCard, { borderColor: holoColor }]}>
                        <Ionicons name={(t.icon_name as any) || 'trophy'} size={28} color={holoColor} />
                        <Text style={styles.trophyLabel} numberOfLines={1}>{t.title}</Text>
                      </View>
                    ))}
                  </ScrollView>
                )}

                <TouchableOpacity style={[styles.historyToggle, { borderColor: holoColor }]} onPress={() => setHistoryVisible(!historyVisible)} activeOpacity={0.8}>
                  <Ionicons name="trophy" size={18} color={holoColor} />
                  <Text style={[styles.historyToggleText, { color: holoColor }]}>{historyVisible ? "CHIUDI RECORD PERSONALI" : `MOSTRA RECORD PERSONALI (${history.length} GIOCHI)`}</Text>
                  <Ionicons name={historyVisible ? "chevron-up" : "chevron-down"} size={16} color={holoColor} />
                </TouchableOpacity>

                {historyVisible && (
                  <View style={styles.historyContainer}>
                    {history.length === 0 ? <Text style={styles.emptyText}>Nessun record personale registrato.</Text> : 
                      history.map((item, idx) => (
                        <View key={item.id || idx} style={styles.historyRow}>
                          <View>
                            <Text style={styles.historyGame}>{item.game_id || 'Simulazione Arcade'}</Text>
                            <Text style={styles.historyDate}>RECORD PERSONALE</Text>
                          </View>
                          <Text style={[styles.historyResult, { color: holoColor }]}>{item.highest_score} PTS</Text>
                        </View>
                      ))
                    }
                  </View>
                )}
              </ScrollView>
            </BlurView>
          </Animated.View>
        )}

        {/* OVERLAY DAILY PROMPT */}
        {isPromptOverlayVisible && dailyPrompt && (
          <Animated.View style={[styles.overlayContainer, { opacity: promptFadeAnim }]}>
              <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <BlurView intensity={95} tint="dark" style={[styles.promptBlur, { borderColor: holoColor }]}>
                    
                    <View style={styles.promptHeader}>
                        <Ionicons name="radio" size={24} color={holoColor} />
                        <Text style={[styles.promptTitle, { color: holoColor }]}>
                            {hasAnsweredToday ? "ARCHIVIO HOLONET" : "TRASMISSIONE HOLONET"}
                        </Text>
                        <TouchableOpacity onPress={togglePromptOverlay}>
                            <Ionicons name="close-circle" size={28} color={holoColor} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView contentContainerStyle={styles.promptScroll}>
                        
                        <View style={styles.seasonBadge}>
                             <Text style={styles.seasonText}>STAGIONE {dailyPrompt.season_id} - GIORNO {dailyPrompt.day_number}/14</Text>
                        </View>

                        {dailyPrompt.winning_response && dailyPrompt.day_number > 1 && (
                            <View style={styles.recapContainer}>
                                <Text style={styles.recapLabel}>LA STORIA IERI:</Text>
                                <Text style={styles.recapText}>"{dailyPrompt.winning_response}" - <Text style={{color: '#FF0055'}}>{dailyPrompt.winning_username}</Text></Text>
                            </View>
                        )}

                        <Text style={styles.promptText}>{dailyPrompt.prompt_text}</Text>

                        {/* SE L'UTENTE HA GIÀ RISPOSTO -> MOSTRA LA SUA STORIA BLOCCATA */}
                        {hasAnsweredToday ? (
                            <View style={styles.completedContainer}>
                                <Text style={styles.completedLabel}>LA TUA TRASMISSIONE:</Text>
                                <Text style={styles.completedText}>"{myTodayResponse}"</Text>
                                <View style={styles.completedDivider} />
                                <Text style={styles.completedSub}>In attesa della continuazione dell'Holonet. Nuova trasmissione disponibile domani.</Text>
                            </View>
                        ) : (
                            /* SE NON HA ANCORA RISPOSTO -> MOSTRA IL CAMPO INPUT */
                            <>
                                <View style={styles.inputContainer}>
                                    <TextInput
                                        style={[styles.textInput, { fontStyle: 'italic' }]}
                                        placeholder="Scrivi la tua frase (max 120 caratteri)..."
                                        placeholderTextColor="#8892B0"
                                        multiline
                                        maxLength={120}
                                        value={userResponse}
                                        onChangeText={setUserResponse}
                                        textAlignVertical="top"
                                    />
                                    <Text style={styles.charCount}>{userResponse.length}/120</Text>
                                </View>

                                <TouchableOpacity 
                                    style={[styles.submitBtn, { backgroundColor: userResponse.trim() ? holoColor : '#233554' }]} 
                                    onPress={submitDailyResponse}
                                    disabled={!userResponse.trim() || submittingResponse}
                                >
                                    {submittingResponse ? (
                                        <ActivityIndicator color="#050B14" />
                                    ) : (
                                        <Text style={[styles.submitText, { color: userResponse.trim() ? '#050B14' : '#8892B0' }]}>
                                            PUBBLICA SULL'HOLONET
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            </>
                        )}

                    </ScrollView>
                </BlurView>
              </KeyboardAvoidingView>
          </Animated.View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#050B14' },

  dashboardContainer: { flex: 1, position: 'relative' },
  webviewFullscreen: { flex: 1, backgroundColor: 'transparent' },
  instructionText: { position: 'absolute', top: 140, left: 0, right: 0, textAlign: 'center', color: '#8892B0', fontSize: 10, fontWeight: 'bold', letterSpacing: 2, opacity: 0.6, pointerEvents: 'none' },
  greetingContainer: { position: 'absolute', top: 85, left: 16, right: 16, alignItems: 'center' },
  greetingText: { fontSize: 13, fontWeight: '900', letterSpacing: 2, textAlign: 'center', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 12, marginBottom: 4 },
  greetingSub: { fontSize: 9, fontWeight: 'bold', letterSpacing: 1.5, textAlign: 'center', opacity: 0.8 },

  hubButtonsAbsolute: { position: 'absolute', bottom: 30, left: 16, right: 16, flexDirection: 'row', gap: 12 },
  hubButton: { flex: 1, borderRadius: 16, borderWidth: 1.5, overflow: 'hidden' },
  hubGradient: { alignItems: 'center', padding: 16, gap: 8 },
  hubButtonTitle: { fontSize: 11, fontWeight: '900', letterSpacing: 1, textAlign: 'center' },

  overlayContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, padding: 16, paddingTop: 40 },
  overlayBlur: { flex: 1, borderRadius: 24, borderWidth: 2, overflow: 'hidden', backgroundColor: 'rgba(5, 11, 20, 0.85)' },
  overlayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  overlayTitle: { fontSize: 16, fontWeight: '900', letterSpacing: 2 },
  overlayScroll: { padding: 20, paddingBottom: 40 },

  statsCard: { marginBottom: 24 },
  avatarMiniRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  avatarMini: { width: 60, height: 60, borderRadius: 30, borderWidth: 2 },
  avatarMiniTextContainer: { width: 60, height: 60, borderRadius: 30, borderWidth: 2, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
  avatarMiniText: { fontSize: 26, fontWeight: '900' },
  cameraIconBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#39FF14', width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  nicknameHeader: { color: '#FFF', fontSize: 20, fontWeight: '900', letterSpacing: 1 },
  factionLabel: { display: 'none' }, 
  settingsBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)' },

  resourceRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)', paddingVertical: 14, borderRadius: 16, borderWidth: 1, borderColor: '#233554' },
  resourceBox: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  resourceValue: { color: '#FFF', fontSize: 16, fontWeight: '900' },
  resourceUnit: { color: '#8892B0', fontSize: 10, fontWeight: 'bold' },
  resourceDivider: { width: 1, height: 24, backgroundColor: '#233554' },

  sectionTitle: { fontSize: 14, fontWeight: '900', letterSpacing: 1.5, marginBottom: 16 },
  emptyText: { color: '#8892B0', fontSize: 12, fontStyle: 'italic', marginBottom: 20 },
  
  trophiesScroll: { gap: 12, marginBottom: 30 },
  trophyCard: { width: 90, height: 90, borderRadius: 16, borderWidth: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 8 },
  trophyLabel: { color: '#FFF', fontSize: 10, fontWeight: 'bold', marginTop: 8, textAlign: 'center' },

  historyToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderRadius: 14, borderWidth: 1, backgroundColor: 'rgba(0,0,0,0.4)', marginBottom: 10 },
  historyToggleText: { fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  historyContainer: { marginBottom: 24, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#233554' },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderColor: '#112240' },
  historyGame: { color: '#E6F1FF', fontSize: 14, fontWeight: 'bold' },
  historyDate: { color: '#8892B0', fontSize: 10, marginTop: 4 },
  historyResult: { fontSize: 15, fontWeight: '900' },

  promptBlur: { flex: 1, borderRadius: 24, borderWidth: 2, overflow: 'hidden', backgroundColor: 'rgba(5, 11, 20, 0.95)' },
  promptHeader: { flexDirection: 'row', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.1)', gap: 12 },
  promptTitle: { fontSize: 15, fontWeight: '900', letterSpacing: 2, flex: 1 },
  promptScroll: { padding: 20, paddingBottom: 40 },
  
  seasonBadge: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginBottom: 20 },
  seasonText: { color: '#FFF', fontSize: 10, fontWeight: 'bold', letterSpacing: 1 },

  recapContainer: { backgroundColor: 'rgba(255, 0, 85, 0.1)', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255, 0, 85, 0.3)', marginBottom: 20 },
  recapLabel: { color: '#FF0055', fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 8 },
  recapText: { color: '#FFF', fontSize: 13, fontStyle: 'italic', lineHeight: 20 },

  promptText: { color: '#E6F1FF', fontSize: 18, fontWeight: '600', lineHeight: 28, marginBottom: 30, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 4 },
  
  inputContainer: { backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 12, borderWidth: 1, borderColor: '#233554', padding: 16, marginBottom: 24 },
  textInput: { color: '#FFF', fontSize: 15, lineHeight: 22, height: 120 },
  charCount: { color: '#8892B0', fontSize: 10, textAlign: 'right', marginTop: 8, fontWeight: 'bold' },

  submitBtn: { paddingVertical: 18, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  submitText: { fontSize: 14, fontWeight: '900', letterSpacing: 1.5 },

  // Stili per lo stato "Completato" (Sola lettura)
  completedContainer: { backgroundColor: 'rgba(57, 255, 20, 0.05)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(57, 255, 20, 0.3)', padding: 16, marginBottom: 24, alignItems: 'center' },
  completedLabel: { color: '#39FF14', fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 12 },
  completedText: { color: '#FFF', fontSize: 14, fontStyle: 'italic', textAlign: 'center', lineHeight: 22, marginBottom: 12 },
  completedDivider: { width: '40%', height: 1, backgroundColor: 'rgba(57, 255, 20, 0.2)', marginBottom: 12 },
  completedSub: { color: '#8892B0', fontSize: 10, fontWeight: 'bold', textAlign: 'center', lineHeight: 16 },

  logoutBtn: { flexDirection: 'row', height: 48, borderRadius: 12, borderWidth: 1, borderColor: '#00E5FF', backgroundColor: 'rgba(0, 229, 255, 0.1)', justifyContent: 'center', alignItems: 'center' },
  logoutText: { color: '#00E5FF', fontWeight: '900', fontSize: 13, letterSpacing: 1 },
  deleteAccountBtn: { flexDirection: 'row', height: 48, borderRadius: 12, borderWidth: 1, borderColor: '#FF0055', backgroundColor: 'rgba(255, 0, 85, 0.1)', justifyContent: 'center', alignItems: 'center' },
  deleteAccountText: { color: '#FF0055', fontWeight: '900', fontSize: 13, letterSpacing: 1 }
});
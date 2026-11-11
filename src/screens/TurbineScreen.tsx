import React, { useRef, useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, StatusBar, Animated, Easing, Modal, Dimensions } from 'react-native';
import { useRoute, useNavigation, useIsFocused } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

const { width } = Dimensions.get('window');
const WHEEL_SIZE = Math.min(width - 40, 340);
const RADIUS = WHEEL_SIZE / 2;
const TAN_15 = 0.26794919243; 
const SLICE_WIDTH = RADIUS * TAN_15 * 2; 

// Colori Stile War Room
const COLORS = {
  BLUE: '#00E5FF',
  GREEN: '#39FF14',
  RED: '#FF0055',
  CRAZY: '#FFD700',
  BLANK: '#121624'
};

// 12 Spicchi: 3 Rosso, 3 Verde, 3 Blu, 2 Vuoti, 1 Crazy
const SECTORS = [
  { id: 0, label: '+5%', type: 'RED', color: COLORS.RED, val: 5, textCol: '#FFF' },
  { id: 1, label: '+10%', type: 'GREEN', color: COLORS.GREEN, val: 10, textCol: '#000' },
  { id: 2, label: 'VUOTO', type: 'BLANK', color: COLORS.BLANK, val: 0, textCol: '#8A93B0' },
  { id: 3, label: '+15%', type: 'BLUE', color: COLORS.BLUE, val: 15, textCol: '#000' },
  { id: 4, label: '+5%', type: 'GREEN', color: COLORS.GREEN, val: 5, textCol: '#000' },
  { id: 5, label: '+10%', type: 'RED', color: COLORS.RED, val: 10, textCol: '#FFF' },
  { id: 6, label: 'CRAZY', type: 'CRAZY', color: COLORS.CRAZY, val: 20, textCol: '#000' },
  { id: 7, label: '+15%', type: 'GREEN', color: COLORS.GREEN, val: 15, textCol: '#000' },
  { id: 8, label: 'VUOTO', type: 'BLANK', color: COLORS.BLANK, val: 0, textCol: '#8A93B0' },
  { id: 9, label: '+5%', type: 'BLUE', color: COLORS.BLUE, val: 5, textCol: '#000' },
  { id: 10, label: '+10%', type: 'BLUE', color: COLORS.BLUE, val: 10, textCol: '#000' },
  { id: 11, label: '+15%', type: 'RED', color: COLORS.RED, val: 15, textCol: '#FFF' },
];

const SECTOR_ANGLE = 360 / SECTORS.length;

export default function TurbineScreen() {
  const navigation = useNavigation<any>();
  const isFocused = useIsFocused();

  const [hasSpunToday, setHasSpunToday] = useState(true); // Default true until checked
  const [nextSpinTime, setNextSpinTime] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  
  const [isSpinning, setIsSpinning] = useState(false);
  const [winningSector, setWinningSector] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [finalMultiplier, setFinalMultiplier] = useState(0);
  const [isWin, setIsWin] = useState(false);

  const spinValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isFocused) checkDailySpin();
  }, [isFocused]);

  const checkDailySpin = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Controllo sul db (tabella fittizia per esempio, aggiusta in base al tuo schema)
    const { data: profile } = await supabase.from('profiles').select('last_turbine_spin').eq('id', user.id).single();
    
    if (profile?.last_turbine_spin) {
      const lastSpin = new Date(profile.last_turbine_spin);
      const now = new Date();
      
      // Calcola le 8:00 AM di oggi
      const resetTimeToday = new Date();
      resetTimeToday.setHours(8, 0, 0, 0);

      // Se il reset di oggi è già passato e l'ultimo spin è precedente al reset, puoi girare
      // Altrimenti se il reset di oggi non è ancora passato, devi aspettare le 8 di oggi.
      let nextReset = new Date(resetTimeToday);
      if (now > resetTimeToday) {
         if (lastSpin < resetTimeToday) {
            setHasSpunToday(false);
            return;
         }
         // Hai già girato oggi dopo le 8, il prossimo reset è domani alle 8
         nextReset.setDate(nextReset.getDate() + 1);
      } else {
         if (lastSpin < new Date(resetTimeToday.getTime() - 24*60*60*1000)) {
             setHasSpunToday(false);
             return;
         }
      }

      setHasSpunToday(true);
      // Countdown semplice per la UI
      const diffMs = nextReset.getTime() - now.getTime();
      const diffHrs = Math.floor(diffMs / 3600000);
      const diffMins = Math.floor((diffMs % 3600000) / 60000);
      setNextSpinTime(`${diffHrs}h ${diffMins}m`);

    } else {
      setHasSpunToday(false);
    }
  };

  const startSpinning = () => {
    if (isSpinning || hasSpunToday || !selectedColor) return;
    setIsSpinning(true);
    setWinningSector(null);

    const winnerIndex = Math.floor(Math.random() * SECTORS.length);
    const winner = SECTORS[winnerIndex];

    spinValue.setValue(0);
    const fullSpins = 360 * 8; 
    const randomOffset = (Math.random() * (SECTOR_ANGLE - 4)) - ((SECTOR_ANGLE - 4) / 2);
    const targetAngle = fullSpins + (360 - (winnerIndex * SECTOR_ANGLE)) + randomOffset;

    Animated.timing(spinValue, {
      toValue: targetAngle,
      duration: 8000, 
      easing: Easing.bezier(0.15, 0.9, 0.25, 1), 
      useNativeDriver: true,
    }).start(async () => {
      setIsSpinning(false);
      setWinningSector(winner);
      setHasSpunToday(true);

      // Logica Vittoria
      let won = false;
      let multiplierReward = 0;

      if (winner.type === 'CRAZY') {
        won = true;
        multiplierReward = winner.val; // +20%
      } else if (winner.type === selectedColor) {
        won = true;
        multiplierReward = winner.val;
      }

      setIsWin(won);
      setFinalMultiplier(multiplierReward);

      // Salva sul database il tentativo e la vincita
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('profiles').update({ 
           last_turbine_spin: new Date().toISOString(),
           current_game_multiplier: won ? multiplierReward : 0 
        }).eq('id', user.id);
      }
      setModalVisible(true);
    });
  };

  const spinInterpolation = spinValue.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] });

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      
      {/* Header stile War Room */}
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
          <Text style={styles.headerTag}>DAILY SPIN // RESET H 08:00</Text>
          <Text style={styles.headerTitle}>TURBINA OLOGRAFICA</Text>
        </View>
        
        <View style={{ width: 40 }} /> 
      </BlurView>

      <View style={styles.container}>
        
        {/* Scelta Colore */}
        {!isSpinning && !hasSpunToday && (
          <View style={styles.choiceContainer}>
            <Text style={styles.choiceTitle}>PREVISIONE NEURALE</Text>
            <Text style={styles.choiceSub}>Su quale colore si fermerà la ruota?</Text>
            
            <View style={styles.colorsRow}>
              <TouchableOpacity style={[styles.colorBtn, {backgroundColor: COLORS.RED, opacity: selectedColor === 'RED' ? 1 : 0.4}]} onPress={() => setSelectedColor('RED')}>
                <Text style={[styles.colorBtnText, {color: '#FFF'}]}>ROSSO</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.colorBtn, {backgroundColor: COLORS.GREEN, opacity: selectedColor === 'GREEN' ? 1 : 0.4}]} onPress={() => setSelectedColor('GREEN')}>
                <Text style={[styles.colorBtnText, {color: '#000'}]}>VERDE</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.colorBtn, {backgroundColor: COLORS.BLUE, opacity: selectedColor === 'BLUE' ? 1 : 0.4}]} onPress={() => setSelectedColor('BLUE')}>
                <Text style={[styles.colorBtnText, {color: '#000'}]}>BLU</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* MESSAGGIO GIA GIRATO */}
        {hasSpunToday && !isSpinning && !modalVisible && (
          <View style={styles.lockContainer}>
            <Ionicons name="time" size={32} color="#8A93B0" />
            <Text style={styles.lockTitle}>SISTEMA IN RICARICA</Text>
            <Text style={styles.lockTime}>Nuovo giro disponibile tra: {nextSpinTime}</Text>
          </View>
        )}

        {/* --- LA RUOTA --- */}
        <View style={[styles.wheelWrapper, hasSpunToday && !isSpinning && !modalVisible && {opacity: 0.3}]}>
          
          <View style={styles.pointerOuter}>
            <View style={styles.pointerTriangle} />
            <View style={styles.pointerCore} />
          </View>

          <Animated.View style={[styles.wheel, { transform: [{ rotate: spinInterpolation }] }]}>
            {SECTORS.map((sector, index) => {
              const rotation = index * SECTOR_ANGLE;
              return (
                <View key={`slice-${sector.id}`} style={[styles.sliceContainer, { transform: [{ rotate: `${rotation}deg` }] }]}>
                  <View style={[styles.sliceTriangle, { borderTopColor: sector.color }]} />
                  <View style={styles.sliceTextContainer}>
                    <Text style={[styles.sliceText, { color: sector.textCol, fontSize: sector.type === 'CRAZY' ? 18 : 24 }]}>
                      {sector.label}
                    </Text>
                  </View>
                </View>
              );
            })}
            
            <View style={styles.centerCore}>
              <View style={styles.centerCoreDeep}>
                <Ionicons name="aperture" size={24} color="#00E5FF" />
              </View>
            </View>
          </Animated.View>

          <View style={styles.wheelBezelInner} pointerEvents="none" />
        </View>

        {/* BOTTONE */}
        <TouchableOpacity 
          style={[styles.spinButton, (isSpinning || hasSpunToday || !selectedColor) && styles.spinButtonDisabled]} 
          onPress={startSpinning} 
          disabled={isSpinning || hasSpunToday || !selectedColor} 
          activeOpacity={0.85}
        >
          <View style={[styles.spinButtonInner, (isSpinning || hasSpunToday || !selectedColor) && {borderColor: '#232C45'}]}>
             <Text style={[styles.spinButtonText, (isSpinning || hasSpunToday || !selectedColor) && {color: '#8A93B0'}]}>
               {hasSpunToday ? 'TURBINA BLOCCATA' : !selectedColor ? 'SELEZIONA UN COLORE' : 'ATTIVA TURBINA'}
             </Text>
          </View>
        </TouchableOpacity>

      </View>

      {/* Modal Esito */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { borderColor: isWin ? (winningSector?.type === 'CRAZY' ? COLORS.CRAZY : winningSector?.color) : '#FF0055' }]}>
            
            <Text style={[styles.modalTitle, { color: isWin ? '#39FF14' : '#FF0055' }]}>
              {isWin ? (winningSector?.type === 'CRAZY' ? 'CRAZY BONUS!' : 'PREVISIONE CORRETTA!') : 'PREVISIONE ERRATA'}
            </Text>
            
            <Text style={styles.modalSub}>
              {isWin 
                ? 'Hai sbloccato un potenziamento per i giochi arcade valevole fino a domani alle 08:00.' 
                : 'La turbina non si è fermata sul colore previsto. Nessun bonus applicato per oggi.'}
            </Text>
            
            {isWin && (
              <View style={styles.rewardBox}>
                <Text style={styles.rewardLabel}>MOLTIPLICATORE SBLOCCATO</Text>
                <Text style={styles.rewardValue}>+{finalMultiplier}% PTS</Text>
              </View>
            )}

            <TouchableOpacity style={styles.homeBtn} onPress={() => { setModalVisible(false); navigation.goBack(); }} activeOpacity={0.85}>
              <Text style={styles.homeBtnText}>TORNA ALLA GAME ROOM</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#050B14' },
  headerBlur: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(0, 229, 255, 0.2)', zIndex: 100 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0, 229, 255, 0.1)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(0, 229, 255, 0.3)' },
  headerCenter: { alignItems: 'center' },
  headerTag: { color: '#FFD700', fontSize: 9, fontWeight: '900', letterSpacing: 1.5, marginBottom: 2 },
  headerTitle: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 1 },
  
  container: { flex: 1, alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 24 },
  
  choiceContainer: { alignItems: 'center', backgroundColor: 'rgba(10, 25, 47, 0.8)', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#1E2538', width: '100%' },
  choiceTitle: { color: '#00E5FF', fontSize: 14, fontWeight: '900', letterSpacing: 1, marginBottom: 4 },
  choiceSub: { color: '#8A93B0', fontSize: 11, marginBottom: 12 },
  colorsRow: { flexDirection: 'row', gap: 10, width: '100%' },
  colorBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  colorBtnText: { fontWeight: '900', fontSize: 12, letterSpacing: 1 },

  lockContainer: { alignItems: 'center', backgroundColor: 'rgba(10, 25, 47, 0.5)', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#1E2538', width: '100%' },
  lockTitle: { color: '#8A93B0', fontSize: 14, fontWeight: '900', letterSpacing: 1, marginTop: 8, marginBottom: 4 },
  lockTime: { color: '#E6F1FF', fontSize: 12, fontWeight: 'bold' },

  wheelWrapper: { width: WHEEL_SIZE, height: WHEEL_SIZE, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  pointerOuter: { position: 'absolute', top: -15, zIndex: 100, alignItems: 'center', shadowColor: '#000', shadowOpacity: 1, shadowOffset: {width: 0, height: 6}, shadowRadius: 8, elevation: 15 },
  pointerTriangle: { width: 0, height: 0, borderLeftWidth: 18, borderRightWidth: 18, borderTopWidth: 36, borderStyle: 'solid', backgroundColor: 'transparent', borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#00E5FF' },
  pointerCore: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#050B14', position: 'absolute', top: 4, elevation: 10, borderWidth: 2, borderColor: '#00E5FF' },
  
  wheel: { width: WHEEL_SIZE, height: WHEEL_SIZE, borderRadius: RADIUS, backgroundColor: '#121624', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  sliceContainer: { position: 'absolute', top: 0, left: RADIUS - (SLICE_WIDTH / 2), width: SLICE_WIDTH, height: WHEEL_SIZE, alignItems: 'center' },
  sliceTriangle: { width: 0, height: 0, backgroundColor: 'transparent', borderStyle: 'solid', borderLeftWidth: SLICE_WIDTH / 2, borderRightWidth: SLICE_WIDTH / 2, borderTopWidth: RADIUS, borderLeftColor: 'transparent', borderRightColor: 'transparent' },
  sliceTextContainer: { position: 'absolute', top: 15, alignItems: 'center', width: SLICE_WIDTH, height: RADIUS },
  sliceText: { fontSize: 22, fontWeight: '900', letterSpacing: -1, transform: [{ scaleY: 1.1 }] },
  
  centerCore: { position: 'absolute', width: 60, height: 60, borderRadius: 30, backgroundColor: '#050B14', alignItems: 'center', justifyContent: 'center', shadowColor: '#00E5FF', shadowOpacity: 0.6, shadowRadius: 10, elevation: 10, borderWidth: 2, borderColor: '#00E5FF' },
  centerCoreDeep: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#101726', alignItems: 'center', justifyContent: 'center' },
  wheelBezelInner: { position: 'absolute', width: WHEEL_SIZE, height: WHEEL_SIZE, borderRadius: RADIUS, borderWidth: 4, borderColor: '#00E5FF', zIndex: 11 },
  
  spinButton: { width: '100%', borderRadius: 16, backgroundColor: '#00E5FF', shadowColor: '#00E5FF', shadowOpacity: 0.4, shadowRadius: 10, elevation: 5 },
  spinButtonInner: { backgroundColor: '#101726', paddingVertical: 18, borderRadius: 14, alignItems: 'center', borderWidth: 2, borderColor: '#00E5FF' },
  spinButtonDisabled: { backgroundColor: '#1E2538', shadowOpacity: 0, elevation: 0 },
  spinButtonText: { color: '#00E5FF', fontSize: 16, fontWeight: '900', letterSpacing: 2 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(5, 11, 20, 0.95)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { width: '100%', backgroundColor: '#101726', borderRadius: 24, borderWidth: 2, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOpacity: 1, shadowRadius: 30, elevation: 20 },
  modalTitle: { fontSize: 24, fontWeight: '900', letterSpacing: 1, marginBottom: 12, textAlign: 'center' },
  modalSub: { fontSize: 13, color: '#8A93B0', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  
  rewardBox: { backgroundColor: 'rgba(57, 255, 20, 0.1)', padding: 16, borderRadius: 12, width: '100%', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(57, 255, 20, 0.3)', marginBottom: 24 },
  rewardLabel: { color: '#39FF14', fontSize: 10, fontWeight: '900', letterSpacing: 2, marginBottom: 4 },
  rewardValue: { color: '#FFF', fontSize: 32, fontWeight: '900' },

  homeBtn: { width: '100%', paddingVertical: 16, borderRadius: 12, alignItems: 'center', backgroundColor: '#00E5FF' },
  homeBtnText: { fontSize: 14, fontWeight: '900', letterSpacing: 1, color: '#050B14' },
});
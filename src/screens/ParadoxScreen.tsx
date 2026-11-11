import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, SafeAreaView, Modal, ActivityIndicator, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { supabase } from '../lib/supabase';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

interface Challenge {
  firewall_question: string;
  firewall_answer: string;
  fermi_question: string;
  fermi_answer: number;
}

export default function ParadoxScreen() {
  const navigation = useNavigation<NavProp>();
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  
  const [firewallGuess, setFirewallGuess] = useState('');
  const [fermiGuess, setFermiGuess] = useState('');
  
  const [modalVisible, setModalVisible] = useState(false);
  const [results, setResults] = useState<any>(null);

  useEffect(() => {
    fetchChallenge();
  }, []);

  const fetchChallenge = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase.from('daily_challenges').select('*').eq('play_date', today).single();
      
      if (data) {
        setChallenge(data);
      } else {
        // Fallback locale di emergenza
        setChallenge({
          firewall_question: "Crittografia di base: decifra 'IBQFS' con shift -1.",
          firewall_answer: "HAPER",
          fermi_question: "Quanti litri d'acqua piovono su New York durante un temporale medio di 2 ore?",
          fermi_answer: 15000000000
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const calculateScore = () => {
    if (!challenge) return;

    const firewallCorrect = firewallGuess.trim().toUpperCase() === challenge.firewall_answer.toUpperCase();
    const fGuess = parseInt(fermiGuess) || 0;
    
    // Moltiplicatore base
    let baseMultiplier = firewallCorrect ? 2.0 : 1.0;
    
    // Calcolo bonus Fermi (Max +8.0x)
    const errorAbs = Math.abs(fGuess - challenge.fermi_answer);
    const errorPercent = errorAbs / challenge.fermi_answer;
    
    let fermiBonus = 0;
    if (errorPercent < 1.0) {
      // Bonus proporzionale alla precisione
      fermiBonus = 8.0 * (1 - errorPercent);
    }

    const totalMultiplier = Math.min(10.0, baseMultiplier + fermiBonus);

    setResults({
      firewallPassed: firewallCorrect,
      actualFermi: challenge.fermi_answer,
      multiplier: totalMultiplier.toFixed(2),
      energyEarned: Math.round(50 * totalMultiplier)
    });
    setModalVisible(true);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#00F0FF" />
        <Text style={{color: '#00F0FF', marginTop: 16}}>Decrittazione protocolli giornalieri...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <View style={styles.topNavigation}>
        <TouchableOpacity style={styles.navButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#00F0FF" />
        </TouchableOpacity>
        <Text style={styles.screenTitle}>IL PARADOSSO - {step === 1 ? 'FIREWALL' : 'NUCLEO'}</Text> 
        <View style={{width: 40}} />
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {step === 1 ? (
          <>
            <View style={styles.header}>
              <Text style={styles.headerTag}>LIVELLO 1: AUTENTICAZIONE</Text>
              <Text style={styles.headerTitle}>Violazione Firewall</Text>
            </View>

            <View style={styles.card}>
              <Ionicons name="lock-closed" size={32} color="#FF0055" style={{marginBottom: 10}} />
              <Text style={styles.questionText}>{challenge?.firewall_question}</Text>
            </View>
            
            <TextInput 
              style={styles.input} 
              placeholder="Inserisci la chiave di sblocco..." 
              placeholderTextColor="#4A5578" 
              value={firewallGuess} 
              onChangeText={setFirewallGuess} 
              autoCapitalize="characters"
            />

            <TouchableOpacity style={styles.submitBtn} activeOpacity={0.8} onPress={() => setStep(2)}>
              <Text style={styles.submitText}>INFILTRA IL NUCLEO ➔</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.header}>
              <Text style={styles.headerTag}>LIVELLO 2: DEDUZIONE QUANTISTICA</Text>
              <Text style={styles.headerTitle}>Problema di Fermi</Text>
            </View>

            <View style={[styles.card, {borderColor: '#00F0FF'}]}>
              <Ionicons name="infinite" size={32} color="#00F0FF" style={{marginBottom: 10}} />
              <Text style={styles.questionText}>{challenge?.fermi_question}</Text>
            </View>
            
            <TextInput 
              style={styles.input} 
              placeholder="Stima numerica esatta..." 
              placeholderTextColor="#4A5578" 
              keyboardType="numeric" 
              value={fermiGuess} 
              onChangeText={setFermiGuess} 
            />

            <View style={{flexDirection: 'row', gap: 10, marginTop: 10}}>
              <TouchableOpacity style={[styles.submitBtn, {flex: 1, backgroundColor: '#1E2538', shadowOpacity: 0}]} onPress={() => setStep(1)}>
                <Text style={styles.submitText}>INDIETRO</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.submitBtn, {flex: 2, backgroundColor: '#B026FF'}]} onPress={calculateScore}>
                <Text style={styles.submitText}>CONFERMA ESTREMAZIONE ⚡</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>

      {/* Modal Risultati */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>RISULTATO VIOLAZIONE</Text>
            
            <View style={styles.statBox}>
              <View style={styles.statRow}>
                <Text style={styles.statName}>Stato Firewall:</Text>
                <Text style={[styles.statValue, {color: results?.firewallPassed ? '#39FF14' : '#FF0055'}]}>
                  {results?.firewallPassed ? 'BYPASSATO (Base x2.0)' : 'FALLITO (Base x1.0)'}
                </Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statName}>Dato Reale Fermi:</Text>
                <Text style={styles.statValue}>{results?.actualFermi}</Text>
              </View>
            </View>
            
            <Text style={styles.multiText}>Moltiplicatore Fisato: x{results?.multiplier}</Text>

            <TouchableOpacity style={styles.turbineButton} activeOpacity={0.8} onPress={() => { setModalVisible(false); navigation.navigate('Turbine', { multiplier: parseFloat(results?.multiplier) }); }}>
              <Text style={styles.turbineButtonText}>ACCEDI ALLA TURBINA 🌀</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0B0D17' }, 
  center: { flex: 1, backgroundColor: '#0B0D17', justifyContent: 'center', alignItems: 'center' },
  topNavigation: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#121624', borderBottomWidth: 1, borderBottomColor: '#1E2538' },
  navButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#00F0FF1A', justifyContent: 'center', alignItems: 'center' },
  screenTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold', letterSpacing: 1 },
  container: { padding: 20, paddingBottom: 50 },
  header: { marginBottom: 24 },
  headerTag: { color: '#00F0FF', fontSize: 11, letterSpacing: 2, fontWeight: '700', marginBottom: 4 },
  headerTitle: { color: '#FFFFFF', fontSize: 26, fontWeight: '900', letterSpacing: 1 },
  card: { backgroundColor: '#121624', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#FF0055', marginBottom: 24 },
  questionText: { color: '#E0E6ED', fontSize: 16, fontWeight: '600', lineHeight: 24 },
  input: { backgroundColor: '#121624', color: '#FFF', borderRadius: 12, paddingHorizontal: 16, height: 56, borderWidth: 1, borderColor: '#1E2538', fontSize: 16, marginBottom: 20 },
  submitBtn: { backgroundColor: '#FF0055', padding: 16, borderRadius: 12, alignItems: 'center', shadowColor: '#FF0055', shadowOpacity: 0.4, shadowOffset: {width: 0, height: 4}, shadowRadius: 10 },
  submitText: { color: '#FFF', fontWeight: '900', fontSize: 14, letterSpacing: 1 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(5,7,13,0.95)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#121624', padding: 24, borderRadius: 20, borderWidth: 1.5, borderColor: '#39FF14' },
  modalTitle: { color: '#39FF14', fontSize: 14, fontWeight: '900', textAlign: 'center', marginBottom: 20, letterSpacing: 2 },
  statBox: { backgroundColor: '#181E30', padding: 16, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: '#232C45' },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  statName: { color: '#8A93B0', fontSize: 13, fontWeight: '600' },
  statValue: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  multiText: { color: '#00F0FF', fontSize: 20, fontWeight: '900', textAlign: 'center', marginBottom: 24 },
  turbineButton: { backgroundColor: '#39FF14', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  turbineButtonText: { color: '#0B0D17', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 }
});
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

type GameRulesNavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface RuleSection {
  id: string;
  title: string;
  category: 'core' | 'multiplayer' | 'arcade' | 'faction';
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  subtitle: string;
  rules: string[];
}

const RULES_DATA: RuleSection[] = [
  {
    id: 'paradox',
    title: 'Il Paradosso',
    category: 'core',
    icon: 'infinite',
    color: '#B026FF',
    subtitle: 'Logica, Deduzione & Tentativi',
    rules: [
      'Obiettivo: Indovinare la sequenza o il codice nascosto nel minor numero di tentativi possibile.',
      'Ogni tentativo riceve feedback in tempo reale su cifre corrette o posizioni esatte.',
      'Gestione Risorse: Ogni errore consuma energia neurale; esaurire i tentativi causa il blocco temporaneo del terminale.',
      'Strategia: Analizza la matrice logica precedente prima di inviare un nuovo input.'
    ]
  },
  {
    id: 'turbine',
    title: 'La Turbina',
    category: 'core',
    icon: 'speedometer',
    color: '#00F0FF',
    subtitle: 'Tempismo, Reattività & Moltiplicatori',
    rules: [
      'Obiettivo: Intercettare il flusso energetico al millisecondo per massimizzare il moltiplicatore.',
      'Meccanica: Un indicatore oscillante richiede un tap preciso quando entra nella zona critica.',
      'Rischio/Ricompensa: Più tenti di avvicinarti al centro perfetto, maggiore è il rischio di sovraccarico azzerando il punteggio.',
      'Bonus: Catene di successi consecutivi attivano lo stato di Superconduttività.'
    ]
  },
  {
    id: 'dominio15',
    title: 'Dominio 15',
    category: 'multiplayer',
    icon: 'grid',
    color: '#00E5FF',
    subtitle: 'Tattica su Board 4x4 Competitivo',
    rules: [
      'Obiettivo: Posizionare e combinare tessere numeriche o simboliche per dominare la griglia 4x4.',
      'Turni: Ogni giocatore dispone di un tempo limite per compiere la propria mossa.',
      'Vittoria: Ottiene il controllo del settore chi totalizza il punteggio più alto o completa combinazioni di controllo strategico.',
      'Interazione: È possibile bloccare le mosse avversarie sfruttando i nodi di pressione adiacenti.'
    ]
  },
  {
    id: 'party',
    title: 'Party Protocol (Deception)',
    category: 'multiplayer',
    icon: 'game-controller',
    color: '#39FF14',
    subtitle: 'Bluff, Inganno & Votazioni Fibbage-Style',
    rules: [
      'Creazione Stanza: L\'Host genera un codice sicuro e avvia il match multiplayer.',
      'Fase di Bluff: Il sistema assegna una domanda o una traccia; i giocatori inseriscono risposte false ma verosimili.',
      'Votazione: Tutti i partecipanti votano tra le risposte inventate e quella corretta.',
      'Punteggi: Ottieni punti ingannando gli altri giocatori votando per la tua bufala e indovinando quella vera.'
    ]
  },
  {
    id: 'arcade',
    title: 'Arcade Quotidiano',
    category: 'arcade',
    icon: 'trophy',
    color: '#FF8800',
    subtitle: 'ColorMatch, GravityRunner, NinjaSlice & StroopTest',
    rules: [
      'ColorMatch: Abbina rapidamente i flussi cromatici prima dello scadere del timer.',
      'GravityRunner: Salta gli ostacoli gravitazionali in un ambiente cyberpunk a scorrimento.',
      'NinjaSlice: Taglia i dati corrotti in arrivo evitando le mine di sistema.',
      'StroopTest & Altri: Metti alla prova riflessi cognitivi e memoria con card e contatori visivi.'
    ]
  },
  {
    id: 'faction',
    title: 'Guerra delle Fazioni',
    category: 'faction',
    icon: 'shield-half',
    color: '#FF0055',
    subtitle: 'Calderone, Energia & Mappa Olografica',
    rules: [
      'Affiliazione: Scegli la tua fazione e contribuisci alle risorse globali.',
      'Il Calderone: Deposita energia e punti guadagnati nei minigiochi per potenziare il settore di appartenenza.',
      'Mappa Olografica: Monitora in tempo reale il controllo dei territori globali.',
      'Conquista: La fazione con più energia accumulata alla fine del ciclo temporale conquista il settore strategico.'
    ]
  }
];

export default function GameRulesScreen() {
  const navigation = useNavigation<GameRulesNavigationProp>();
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'core' | 'multiplayer' | 'arcade' | 'faction'>('all');

  const filteredRules = selectedCategory === 'all' 
    ? RULES_DATA 
    : RULES_DATA.filter(item => item.category === selectedCategory);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <BlurView intensity={90} tint="dark" style={styles.headerBlur}>
        <View style={styles.headerContainer}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="arrow-back" size={24} color="#00F0FF" />
          </TouchableOpacity>
          <View style={styles.headerTitleBox}>
            <Text style={styles.headerTag}>DATABASE DI SISTEMA // CODEX</Text>
            <Text style={styles.headerTitle}>Manuale Operativo</Text>
          </View>
          <View style={styles.headerIconBox}>
            <Ionicons name="book" size={20} color="#00F0FF" />
          </View>
        </View>
      </BlurView>

      {/* Category Filter Tabs */}
      <View style={styles.tabContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
          {[
            { key: 'all', label: 'TUTTI' },
            { key: 'core', label: 'CORE' },
            { key: 'multiplayer', label: 'MULTIPLAYER' },
            { key: 'arcade', label: 'ARCADE' },
            { key: 'faction', label: 'FAZIONI' },
          ].map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tabButton,
                selectedCategory === tab.key && styles.tabButtonActive
              ]}
              onPress={() => setSelectedCategory(tab.key as any)}
              activeOpacity={0.8}
            >
              <Text style={[
                styles.tabText,
                selectedCategory === tab.key && styles.tabTextActive
              ]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Content Scroll */}
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.introNote}>
          Consulta i protocolli ufficiali di gioco, le meccaniche di combattimento cibernetico e le direttive per la conquista delle fazioni.
        </Text>

        {filteredRules.map(section => (
          <View key={section.id} style={styles.cardWrapper}>
            <BlurView intensity={75} tint="dark" style={[styles.cardBlur, { borderColor: `${section.color}55` }]}>
              <LinearGradient 
                colors={[`${section.color}15`, 'rgba(18, 22, 36, 0.7)']} 
                style={styles.cardGradient}
              >
                {/* Card Header */}
                <View style={styles.cardHeaderRow}>
                  <View style={[styles.iconBox, { backgroundColor: `${section.color}25`, borderColor: section.color }]}>
                    <Ionicons name={section.icon} size={22} color={section.color} />
                  </View>
                  <View style={styles.cardTitleBox}>
                    <Text style={styles.cardCategoryLabel}>{section.category.toUpperCase()} PROTOCOL</Text>
                    <Text style={styles.cardTitle}>{section.title}</Text>
                    <Text style={styles.cardSubtitle}>{section.subtitle}</Text>
                  </View>
                </View>

                {/* Rules List */}
                <View style={styles.rulesList}>
                  {section.rules.map((rule, idx) => (
                    <View key={idx} style={styles.ruleItem}>
                      <View style={[styles.bulletPoint, { backgroundColor: section.color }]} />
                      <Text style={styles.ruleText}>{rule}</Text>
                    </View>
                  ))}
                </View>
              </LinearGradient>
            </BlurView>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#05070A' },
  headerBlur: {
    borderBottomWidth: 1,
    borderBottomColor: '#1E2538',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitleBox: { flex: 1, marginHorizontal: 12 },
  headerTag: { color: '#00FF66', fontSize: 9, letterSpacing: 1.5, fontWeight: '700', marginBottom: 2 },
  headerTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '900', letterSpacing: 0.5 },
  headerIconBox: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0, 240, 255, 0.15)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(0, 240, 255, 0.3)' },

  tabContainer: { borderBottomWidth: 1, borderBottomColor: '#1E2538', backgroundColor: '#0B0D17' },
  tabScroll: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  tabButton: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(255, 255, 255, 0.05)', borderWidth: 1, borderColor: '#1E2538' },
  tabButtonActive: { backgroundColor: 'rgba(0, 240, 255, 0.2)', borderColor: '#00F0FF' },
  tabText: { color: '#8A93B0', fontSize: 11, fontWeight: 'bold', letterSpacing: 1 },
  tabTextActive: { color: '#00F0FF' },

  scrollContent: { padding: 16, paddingBottom: 40 },
  introNote: { color: '#8A93B0', fontSize: 13, lineHeight: 18, marginBottom: 16, fontStyle: 'italic' },

  cardWrapper: { borderRadius: 18, overflow: 'hidden', marginBottom: 16, borderWidth: 1 },
  cardBlur: { borderRadius: 18, overflow: 'hidden' },
  cardGradient: { padding: 18 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255, 255, 255, 0.06)', paddingBottom: 12 },
  iconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1, marginRight: 14 },
  cardTitleBox: { flex: 1 },
  cardCategoryLabel: { color: '#8A93B0', fontSize: 9, fontWeight: 'bold', letterSpacing: 1.5, marginBottom: 2 },
  cardTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', marginBottom: 2 },
  cardSubtitle: { color: '#A0AEC0', fontSize: 12 },

  rulesList: { gap: 10 },
  ruleItem: { flexDirection: 'row', alignItems: 'flex-start' },
  bulletPoint: { width: 6, height: 6, borderRadius: 3, marginTop: 6, marginRight: 10 },
  ruleText: { flex: 1, color: '#C5CEE0', fontSize: 13, lineHeight: 19 }
});

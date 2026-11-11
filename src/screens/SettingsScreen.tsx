import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Switch, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import * as Notifications from 'expo-notifications';

export default function SettingsScreen() {
  const navigation = useNavigation<any>();
  const [notifications, setNotifications] = useState(true);

  const handleNotificationToggle = async (value: boolean) => {
    setNotifications(value);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (value) {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus === 'granted') {
          const tokenData = await Notifications.getExpoPushTokenAsync();
          const pushToken = tokenData.data;
          await supabase.from('profiles').update({ push_token: pushToken }).eq('id', user.id);
        } else {
          Alert.alert('Permesso Negato', 'Impossibile attivare le notifiche neurali senza i permessi di sistema.');
          setNotifications(false);
        }
      } else {
        await supabase.from('profiles').update({ push_token: null }).eq('id', user.id);
      }
    } catch (err) {
      console.error("Errore aggiornamento notifiche push:", err);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Errore logout:", err);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "ELIMINAZIONE ACCOUNT",
      "Sei assolutamente sicuro di voler eliminare il tuo account? L'azione è irreversibile.",
      [
        { text: "Annulla", style: "cancel" },
        { 
          text: "ELIMINA", 
          style: "destructive", 
          onPress: () => {
            Alert.alert(
              "ULTIMA CONFERMA",
              "Tutti i tuoi dati e punteggi verranno cancellati definitivamente. Procedere?",
              [
                { text: "Annulla", style: "cancel" },
                {
                  text: "Sì, elimina tutto",
                  style: "destructive",
                  onPress: async () => {
                    try {
                      const { error } = await supabase.rpc('delete_current_user');
                      if (error) throw error;
                      await supabase.auth.signOut();
                    } catch (err: any) {
                      console.error("Errore eliminazione account:", err);
                      Alert.alert("Errore", "Errore durante l'eliminazione: " + (err?.message || "Errore sconosciuto"));
                    }
                  }
                }
              ]
            );
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topNavigation}>
        <TouchableOpacity style={styles.navButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#00F0FF" />
        </TouchableOpacity>
        <Text style={styles.screenTitle}>IMPOSTAZIONI SISTEMA</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.sectionTitle}>PREFERENZE AGENTE</Text>
        
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingName}>Notifiche Neurali</Text>
            <Text style={styles.settingDesc}>Ricevi avvisi per i nuovi messaggi criptati e notifiche push</Text>
          </View>
          <Switch 
            value={notifications} 
            onValueChange={handleNotificationToggle} 
            trackColor={{ false: '#1E2538', true: '#00F0FF55' }}
            thumbColor={notifications ? '#00F0FF' : '#4A5578'}
          />
        </View>

        <Text style={styles.sectionTitle}>ZONA CRITICA</Text>
        
        <View style={styles.criticalButtonsContainer}>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
            <Ionicons name="log-out-outline" size={20} color="#00E5FF" style={{ marginRight: 8 }} />
            <Text style={styles.logoutText}>LOGOUT</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.deleteAccountBtn} onPress={handleDeleteAccount} activeOpacity={0.8}>
            <Ionicons name="trash-outline" size={20} color="#FF0055" style={{ marginRight: 8 }} />
            <Text style={styles.deleteAccountText}>ELIMINA ACCOUNT</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0B0D17' },
  topNavigation: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#121624', borderBottomWidth: 1, borderBottomColor: '#1E2538' },
  navButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#00F0FF1A', justifyContent: 'center', alignItems: 'center' },
  screenTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold', letterSpacing: 1 },
  container: { padding: 20 },
  sectionTitle: { color: '#8A93B0', fontSize: 12, fontWeight: 'bold', letterSpacing: 1.5, marginBottom: 16, marginTop: 10 },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#121624', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#1E2538', marginBottom: 12 },
  settingInfo: { flex: 1, paddingRight: 16 },
  settingName: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  settingDesc: { color: '#4A5578', fontSize: 12 },
  
  criticalButtonsContainer: { gap: 12 },
  logoutBtn: { flexDirection: 'row', height: 50, borderRadius: 12, borderWidth: 1, borderColor: '#00E5FF', backgroundColor: 'rgba(0, 229, 255, 0.1)', justifyContent: 'center', alignItems: 'center' },
  logoutText: { color: '#00E5FF', fontWeight: '900', fontSize: 14, letterSpacing: 1 },
  deleteAccountBtn: { flexDirection: 'row', height: 50, borderRadius: 12, borderWidth: 1, borderColor: '#FF0055', backgroundColor: 'rgba(255, 0, 85, 0.1)', justifyContent: 'center', alignItems: 'center' },
  deleteAccountText: { color: '#FF0055', fontWeight: '900', fontSize: 14, letterSpacing: 1 }
});

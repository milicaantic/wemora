// Spike A: ručno napisan RN ekran. Svaki element postoji u više varijanti,
// da vidimo koje pisanje Playwright selektori nalaze na Expo webu.
import { useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';

export default function SpikeScreen() {
  const [query, setQuery] = useState('');
  const [lastAction, setLastAction] = useState('nijedna');

  return (
    <View style={{ padding: 16, gap: 12 }}>
      {/* Polje: samo accessibilityLabel */}
      <TextInput
        accessibilityLabel="Pretraga"
        value={query}
        onChangeText={setQuery}
        style={{ borderWidth: 1, padding: 8 }}
      />
      <Text>Tražite: {query}</Text>

      {/* Dugme A: Pressable + Text, bez uloge */}
      <Pressable onPress={() => setLastAction('Traži')}>
        <Text>Traži</Text>
      </Pressable>

      {/* Dugme B: role="button" */}
      <Pressable role="button" onPress={() => setLastAction('Sačuvaj')}>
        <Text>Sačuvaj</Text>
      </Pressable>

      {/* Dugme C: stari zapis accessibilityRole="button" */}
      <Pressable accessibilityRole="button" onPress={() => setLastAction('Obriši')}>
        <Text>Obriši</Text>
      </Pressable>

      <Text>Poslednja radnja: {lastAction}</Text>

      {/* Lista A: FlatList bez uloga */}
      <FlatList
        data={['Jabuka', 'Kruška', 'Šljiva']}
        keyExtractor={(item) => item}
        renderItem={({ item }) => <Text>{item}</Text>}
      />

      {/* Lista B: View sa role="list" i role="listitem" */}
      <View role="list">
        {['Supa', 'Čorba', 'Paprikaš'].map((item) => (
          <View role="listitem" key={item}>
            <Text>{item}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// Namerno pokvaren ekran: baca grešku pri renderovanju.
import { Text } from 'react-native';

export default function BrokenRender() {
  const recipe = undefined as unknown as { title: string };
  return <Text>{recipe.title}</Text>;
}

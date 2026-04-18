import { TouchableOpacity, useColorScheme } from 'react-native';
import { Plus } from 'lucide-react-native';
import { useQuickAdd } from '../contexts/QuickAddContext';

export function FAB() {
  const { open } = useQuickAdd();
  const isDark = useColorScheme() === 'dark';

  return (
    <TouchableOpacity
      onPress={open}
      activeOpacity={0.85}
      className="absolute bottom-24 right-5 w-14 h-14 rounded-full bg-sky-500 items-center justify-center shadow-lg"
      style={{ elevation: 8 }}
    >
      <Plus size={26} color="white" strokeWidth={2.5} />
    </TouchableOpacity>
  );
}

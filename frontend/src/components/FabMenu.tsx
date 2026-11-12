import { Plus, Trash2, LogOut, List, X } from 'lucide-react'

interface Props {
  isOpen: boolean
  onToggle: () => void
  onClearChat: () => void
  onLogout: () => void
  onToggleHistory: () => void
}

const MENU_ITEMS = [
  { icon: <List className="w-4 h-4" />,    label: 'इतिहास', action: 'history' },
  { icon: <Trash2 className="w-4 h-4" />,  label: 'साफ करें', action: 'clear' },
  { icon: <LogOut className="w-4 h-4" />,  label: 'लॉक करें', action: 'logout' },
]

export default function FabMenu({ isOpen, onToggle, onClearChat, onLogout, onToggleHistory }: Props) {
  const handleAction = (action: string) => {
    if (action === 'history') onToggleHistory()
    if (action === 'clear')   onClearChat()
    if (action === 'logout')  onLogout()
  }

  return (
    <div className="absolute bottom-6 right-5 flex flex-col items-end gap-3 z-40">
      {/* Menu items */}
      {isOpen && (
        <div className="flex flex-col items-end gap-2 animate-fade-up">
          {MENU_ITEMS.map(item => (
            <button
              key={item.action}
              onClick={() => handleAction(item.action)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl
                         bg-gray-900 border border-gray-700 text-gray-300
                         text-xs hover:text-white hover:border-gray-500
                         transition-all duration-200 active:scale-95"
            >
              <span className="text-purple-400">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      )}

      {/* FAB + button */}
      <button
        onClick={onToggle}
        className="fab-btn transition-transform duration-300"
        style={{ transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)' }}
      >
        <Plus className="w-5 h-5" />
      </button>
    </div>
  )
}

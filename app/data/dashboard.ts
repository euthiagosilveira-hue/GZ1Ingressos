export interface EntryByHour {
  hora: string
  entradas: number
}

export interface PaymentSlice {
  key: 'paid' | 'pending' | 'canceled'
  label: string
  value: number
  color: string
}

export interface RecentOrder {
  id: string
  buyer: string
  tickets: number
  total: string
  payment: 'Pago' | 'Pendente'
  entranceUsed: number
  entranceTotal: number
}

export interface RecentEntry {
  id: string
  name: string
  ticket: string
  time: string
  dateLabel: string
  ok: boolean
  statusLabel: string
}

export interface TodayEvent {
  badge: string
  title: string
  date: string
  time: string
  venue: string
  poster: {
    weekday: string
    day: string
    month: string
    label: string
    name: string
  }
}

export const entriesByHour: EntryByHour[] = [
  { hora: '18h', entradas: 5 },
  { hora: '19h', entradas: 8 },
  { hora: '20h', entradas: 12 },
  { hora: '21h', entradas: 18 },
  { hora: '22h', entradas: 32 },
  { hora: '23h', entradas: 47 },
  { hora: '00h', entradas: 63 },
  { hora: '01h', entradas: 58 },
  { hora: '02h', entradas: 36 },
  { hora: '03h', entradas: 16 },
  { hora: '04h', entradas: 6 }
]

export const paymentStatus: PaymentSlice[] = [
  { key: 'paid', label: 'Pago', value: 326, color: '#22c55e' },
  { key: 'pending', label: 'Pendente', value: 15, color: '#fbbf24' },
  { key: 'canceled', label: 'Cancelado', value: 6, color: '#ef4444' }
]

export const recentOrders: RecentOrder[] = [
  {
    id: '#GZ102458',
    buyer: 'João da Silva',
    tickets: 4,
    total: 'R$ 160,00',
    payment: 'Pago',
    entranceUsed: 2,
    entranceTotal: 4
  },
  {
    id: '#GZ102457',
    buyer: 'Maria Oliveira',
    tickets: 2,
    total: 'R$ 80,00',
    payment: 'Pago',
    entranceUsed: 2,
    entranceTotal: 2
  },
  {
    id: '#GZ102456',
    buyer: 'Carlos Santos',
    tickets: 3,
    total: 'R$ 120,00',
    payment: 'Pago',
    entranceUsed: 1,
    entranceTotal: 3
  },
  {
    id: '#GZ102455',
    buyer: 'Pedro Souza',
    tickets: 1,
    total: 'R$ 40,00',
    payment: 'Pendente',
    entranceUsed: 0,
    entranceTotal: 1
  },
  {
    id: '#GZ102454',
    buyer: 'Ana Paula Lima',
    tickets: 2,
    total: 'R$ 80,00',
    payment: 'Pago',
    entranceUsed: 2,
    entranceTotal: 2
  }
]

export const recentEntries: RecentEntry[] = [
  {
    id: '1',
    name: 'Maria Oliveira',
    ticket: 'Ingresso #02',
    time: '22:47',
    dateLabel: 'Hoje',
    ok: true,
    statusLabel: 'Hoje'
  },
  {
    id: '2',
    name: 'João da Silva',
    ticket: 'Ingresso #01',
    time: '22:45',
    dateLabel: 'Hoje',
    ok: true,
    statusLabel: 'Hoje'
  },
  {
    id: '3',
    name: 'Carlos Santos',
    ticket: 'Ingresso #01',
    time: '22:43',
    dateLabel: 'Hoje',
    ok: true,
    statusLabel: 'Hoje'
  },
  {
    id: '4',
    name: 'Maria Oliveira',
    ticket: 'Ingresso #02',
    time: '22:42',
    dateLabel: 'Já utilizado',
    ok: false,
    statusLabel: 'Já utilizado'
  },
  {
    id: '5',
    name: 'Pedro Souza',
    ticket: 'Ingresso #01',
    time: '22:41',
    dateLabel: 'Hoje',
    ok: true,
    statusLabel: 'Hoje'
  }
]

export const todayEvent: TodayEvent = {
  badge: 'AO VIVO',
  title: 'Banda Conexão',
  date: 'Sábado, 29 de Agosto',
  time: '22:00',
  venue: 'Galeria Zero 1',
  poster: {
    weekday: 'SÁB',
    day: '29',
    month: 'AGO',
    label: 'BANDA',
    name: 'CONEXÃO'
  }
}

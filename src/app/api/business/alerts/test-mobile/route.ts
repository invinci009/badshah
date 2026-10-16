import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/firebase/auth'
import { sendMobileOrderAlarm, getOrderAlertTopic } from '@/lib/server/pushNotifier'

export async function POST(request: NextRequest) {
  const user = await getSessionFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const topic = getOrderAlertTopic()

  const success = await sendMobileOrderAlarm({
    orderNumber: 'TEST-01',
    tableLabel: '5',
    totalPaise: 45000,
    items: [
      { itemName: 'बटर नान (Butter Naan)', quantity: 2 },
      { itemName: 'पनीर टिक्का (Paneer Tikka)', quantity: 1 },
    ],
  })

  return NextResponse.json({
    success,
    topic,
    message: success
      ? `Mobile alarm test sent to topic "${topic}"!`
      : 'Failed to send alert. Check network connection.',
  })
}

import { NextResponse } from 'next/server'
import { FRAMEWORK_CATALOG } from '@/lib/framework-catalog'

// Framework list — powered by the shared catalog
export async function POST() {
  return NextResponse.json(FRAMEWORK_CATALOG)
}

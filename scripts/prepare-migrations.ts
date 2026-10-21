import { nodeFileTrace } from '@vercel/nft'
import { dirname, join, resolve } from 'node:path'
import { loadDocument } from '@zenstackhq/language'
import { PrismaSchemaGenerator } from '@zenstackhq/sdk'
import { cp, mkdir, readdir, writeFile } from 'node:fs/promises'

const root = process.cwd()
const output = resolve(root, '.output/migrate')
const schema = await loadDocument(resolve(root, 'prisma/schema.zmodel'), [], true)
if (!schema.success) throw new Error('Migration schema generation failed')
await mkdir(output, { recursive: true })
await writeFile(join(output, 'schema.prisma'), await new PrismaSchemaGenerator(schema.model).generate())
await cp(resolve(root, 'prisma/migrations'), join(output, 'migrations'), { recursive: true })

// Trace the already locked CLI; keep build tooling and application secrets out of the runtime image.
const cli = 'node_modules/prisma/build/index.js'
const { fileList } = await nodeFileTrace([cli], { base: root, processCwd: root })
const engines = 'node_modules/@prisma/engines'
for (const name of await readdir(resolve(root, engines)))
  if (name.startsWith('schema-engine-') || name.startsWith('libquery_engine-')) fileList.add(join(engines, name))
for (const file of fileList) {
  if (!file.startsWith('node_modules/')) continue
  const target = join(output, file)
  await mkdir(dirname(target), { recursive: true })
  await cp(resolve(root, file), target, { dereference: true })
}
await cp(resolve(root, 'scripts/docker-entrypoint.sh'), resolve(root, '.output/docker-entrypoint.sh'))
console.info('Prepared locked migration CLI, schema and SQL history without database access')

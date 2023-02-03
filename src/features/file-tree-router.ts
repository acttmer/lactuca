import fs from 'fs/promises'
import path from 'path'
import { resolveUrlPaths } from '../common/path'
import { useRouter } from '../http/core/router'

export class FileTreeRouter {
  constructor(private baseDir: string, private prefix = '/') {}

  async compile() {
    const router = useRouter()

    const walk = async (dirname: string, prefix = '/') => {
      const filenames = await fs.readdir(dirname)

      for (const filename of filenames) {
        if (filename.endsWith('.d.ts') || filename.endsWith('.map')) {
          continue
        }

        const filepath = path.resolve(dirname, filename)
        const stat = await fs.stat(filepath)

        const url = resolveUrlPaths(
          prefix,
          filename
            .replace(/^_/g, ':')
            .replace(/(.js|.ts)$/, '')
            .replace(/^index$/, '/'),
        )

        if (stat.isDirectory()) {
          await walk(filepath, url)
        } else {
          router.use(url, require(filepath))
        }
      }
    }

    await walk(this.baseDir, this.prefix)

    return router
  }
}

export const useFileTreeRouter = (baseDir: string, prefix = '/') =>
  new FileTreeRouter(baseDir, prefix)

import { join } from 'node:path'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const pluginFile = (path: string) => readFileSync(join(process.cwd(), 'wordpress/topiqu-sync', path), 'utf8')

describe('Topiqu WordPress plugin contract', () => {
  it('guards manual actions with capabilities and nonces', () => {
    const admin = pluginFile('includes/class-topiqu-admin.php')

    expect(admin).toContain("current_user_can('manage_options')")
    expect(admin).toContain('check_admin_referer($action)')
    expect(admin).toContain('wp_safe_redirect($url)')
  })

  it('authenticates external API requests without logging the key', () => {
    const api = pluginFile('includes/class-topiqu-api.php')
    const sync = pluginFile('includes/class-topiqu-sync.php')

    expect(api).toContain("'x-api-key' => $this->api_key")
    expect(api).toContain('wp_safe_remote_get')
    expect(sync).not.toContain("['api_key']")
  })

  it('only reconciles missing posts after a complete error-free scan', () => {
    const sync = pluginFile('includes/class-topiqu-sync.php')

    expect(sync).toContain("if ($complete && empty($result['errors']))")
    expect(sync).toContain("$result['drafted'] = $this->reconcile_missing($remote_ids)")
    expect(sync).toContain("'post_status' => 'draft'")
    expect(sync).not.toContain('wp_delete_post')
  })

  it('detects local edits in safe mode and locks concurrent runs', () => {
    const sync = pluginFile('includes/class-topiqu-sync.php')

    expect(sync).toContain("private const LOCK = 'topiqu_sync_lock'")
    expect(sync).toContain("'safe' === ($this->settings['update_mode'] ?? 'safe')")
    expect(sync).toContain("get_post_meta($post_id, '_topiqu_import_hash', true)")
    expect(sync).toContain('hash_equals($import_hash, $this->post_hash($post_id))')
  })
})

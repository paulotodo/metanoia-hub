import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';

@Injectable()
export class PasswordCheckerService {
  private readonly logger = new Logger(PasswordCheckerService.name);

  async isLeaked(password: string): Promise<boolean> {
    try {
      const sha1 = createHash('sha1').update(password).digest('hex').toUpperCase();
      const prefix = sha1.slice(0, 5);
      const suffix = sha1.slice(5);

      const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
        headers: { 'Add-Padding': 'true' },
      });

      if (!response.ok) {
        this.logger.warn({ status: response.status }, 'HIBP API unreachable, allowing registration (fail-open)');
        return false;
      }

      const text = await response.text();
      const lines = text.split('\r\n');

      return lines.some((line) => {
        const [hashSuffix] = line.split(':');
        return hashSuffix === suffix;
      });
    } catch (error) {
      this.logger.warn(
        { error: (error as Error).message },
        'HIBP API error, allowing registration (fail-open)',
      );
      return false;
    }
  }
}

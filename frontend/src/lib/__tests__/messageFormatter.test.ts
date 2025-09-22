/**
 * Tests for MessageFormatter and related utilities
 */

import { MessageFormatter, MessageFormattingUtils, StreamingMessageProcessor } from '../messageFormatter';

describe('MessageFormatter', () => {
  let formatter: MessageFormatter;

  beforeEach(() => {
    formatter = new MessageFormatter();
  });

  describe('processChunk', () => {
    it('should handle complete chunks correctly', () => {
      const result = formatter.processChunk({
        data: 'Hello world',
        isComplete: true
      });

      expect(result.text).toBe('Hello world');
      expect(result.isComplete).toBe(true);
      expect(result.needsUpdate).toBe(true);
    });

    it('should handle incomplete markdown code blocks', () => {
      const result = formatter.processChunk({
        data: '```javascript\nconsole.log(',
        isComplete: false
      });

      expect(result.text).toContain('```javascript\nconsole.log(\n```');
    });

    it('should handle incomplete lists', () => {
      const result = formatter.processChunk({
        data: '- Item 1\n- Item 2',
        isComplete: false
      });

      expect(result.text).toContain('- Item 2\n');
    });

    it('should avoid redundant updates when text hasn\'t changed', () => {
      formatter.processChunk({ data: 'test', isComplete: false });
      const result = formatter.processChunk({ data: '', isComplete: false });

      expect(result.needsUpdate).toBe(false);
    });
  });

  describe('finalize', () => {
    it('should properly finalize messages', () => {
      formatter.processChunk({ data: '  test  \n\n\n  message  ', isComplete: true });
      const final = formatter.finalize();

      expect(final).toBe('test  \n\n  message\n');
    });
  });
});

describe('MessageFormattingUtils', () => {
  describe('normalizeMessage', () => {
    it('should normalize whitespace', () => {
      expect(MessageFormattingUtils.normalizeMessage('  test  \n\n\n  message  ')).toBe('test  \n  message');
    });

    it('should handle empty input', () => {
      expect(MessageFormattingUtils.normalizeMessage('')).toBe('');
      expect(MessageFormattingUtils.normalizeMessage(null as any)).toBe('');
    });
  });

  describe('hasIncompleteMarkdown', () => {
    it('should detect incomplete code blocks', () => {
      expect(MessageFormattingUtils.hasIncompleteMarkdown('```')).toBe(true);
      expect(MessageFormattingUtils.hasIncompleteMarkdown('```\n```')).toBe(false);
    });
  });

  describe('validateMessage', () => {
    it('should validate correct message structure', () => {
      const validMessage = {
        sender: 'user',
        text: 'hello',
        timestamp: new Date()
      };
      expect(MessageFormattingUtils.validateMessage(validMessage)).toBe(true);
    });

    it('should reject invalid messages', () => {
      expect(MessageFormattingUtils.validateMessage(null)).toBe(false);
      expect(MessageFormattingUtils.validateMessage({})).toBe(false);
      expect(MessageFormattingUtils.validateMessage({ text: 'hello' })).toBe(false);
    });
  });

  describe('isErrorResponse', () => {
    it('should detect error responses', () => {
      expect(MessageFormattingUtils.isErrorResponse('Error: Something went wrong')).toBe(true);
      expect(MessageFormattingUtils.isErrorResponse('Failed to connect')).toBe(true);
      expect(MessageFormattingUtils.isErrorResponse('Hello world')).toBe(false);
    });
  });

  describe('extractErrorMessage', () => {
    it('should extract error messages', () => {
      expect(MessageFormattingUtils.extractErrorMessage('Error: Network timeout')).toBe('Network timeout');
      expect(MessageFormattingUtils.extractErrorMessage('Failed to connect')).toBe('Failed to connect');
    });
  });
});

describe('StreamingMessageProcessor', () => {
  it('should handle basic streaming', async () => {
    const mockResponse = {
      body: {
        getReader: () => ({
          read: async () => ({ done: true, value: undefined }),
          releaseLock: () => {}
        })
      }
    } as Response;

    const updates: string[] = [];
    const processor = new StreamingMessageProcessor(
      (text) => updates.push(text),
      (error) => console.error(error),
      (final) => updates.push(`FINAL: ${final}`)
    );

    await processor.processStream(mockResponse);
    // Should complete without errors
  });

  it('should handle errors gracefully', async () => {
    const mockResponse = {
      body: {
        getReader: () => ({
          read: async () => { throw new Error('Network error'); },
          releaseLock: () => {}
        })
      }
    } as Response;

    let errorCaught: Error | null = null;
    const processor = new StreamingMessageProcessor(
      () => {},
      (error) => { errorCaught = error; },
      () => {}
    );

    await processor.processStream(mockResponse);
    expect(errorCaught).toBeTruthy();
    expect(errorCaught!.message).toContain('Network error');
  });
});

describe('Integration Tests - Message Types', () => {
  it('should handle markdown code blocks', () => {
    const formatter = new MessageFormatter();

    // Test incomplete code block gets closing tags
    const result = formatter.processChunk({
      data: '```javascript\nconsole.log("hello")',
      isComplete: false
    });
    expect(result.text).toContain('```javascript\nconsole.log("hello")\n```');
  });

  it('should handle error message detection', () => {
    expect(MessageFormattingUtils.isErrorResponse('Error: Network timeout')).toBe(true);
    expect(MessageFormattingUtils.isErrorResponse('Hello world')).toBe(false);
  });

  it('should sanitize malicious content', () => {
    const maliciousText = '<script>alert("xss")</script>Hello';
    const sanitized = MessageFormattingUtils.sanitizeMessage(maliciousText);
    expect(sanitized).not.toContain('<script>');
    expect(sanitized).toContain('Hello');
  });
});
const { setInterval } = global;

function log(message, detail) {
  if (detail !== undefined) {
    console.log(`[theta-background] ${message}`, detail);
  } else {
    console.log(`[theta-background] ${message}`);
  }
}

async function initializeProvider() {
  try {
    const { HttpProvider } = await import('mc-reg');
    const provider = new HttpProvider();
    log('Provider initialized successfully', !!provider);
  } catch (error) {
    log('Provider initialization failed');
    console.error(error);
  }
}

log('Background script started');

void initializeProvider();

setInterval(() => {
  void initializeProvider();
}, 60000);

process.on('SIGINT', () => {
  log('Stopping background script');
  process.exit(0);
});

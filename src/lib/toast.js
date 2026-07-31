// Tiny toast store: a module-level subscriber list so any component can call
// `toast.success(...)` / `toast.error(...)` without prop drilling. The
// <Toaster /> component subscribes on mount and renders the active queue.
const subscribers = new Set();
let queue = [];
let nextId = 1;

function emit() {
  for (const subscriber of subscribers) subscriber(queue);
}

export function subscribeToasts(callback) {
  subscribers.add(callback);
  callback(queue);
  return () => subscribers.delete(callback);
}

function push(kind, message, options = {}) {
  const id = nextId++;
  const toast = { id, kind, message, duration: options.duration ?? 4000 };
  queue = [...queue, toast];
  emit();
  if (toast.duration > 0) {
    setTimeout(() => dismissToast(id), toast.duration);
  }
  return id;
}

export function dismissToast(id) {
  queue = queue.filter((item) => item.id !== id);
  emit();
}

export const toast = {
  success(message, options) {
    return push("success", message, options);
  },
  error(message, options) {
    return push("error", message, { duration: 6000, ...options });
  },
  info(message, options) {
    return push("info", message, options);
  },
  dismiss(id) {
    if (id !== undefined) dismissToast(id);
    else {
      queue = [];
      emit();
    }
  },
};

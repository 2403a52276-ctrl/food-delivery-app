// Assignment 7: Behavioral Design Patterns II
// Food Delivery App — plain JavaScript OOP demonstration.

// ---------- Sample menu and application state ----------
const menuItems = [
  { id: 1, name: "Classic Burger", description: "Grilled patty, lettuce and house sauce", price: 149, emoji: "🍔" },
  { id: 2, name: "Margherita Pizza", description: "Tomato, mozzarella and basil", price: 229, emoji: "🍕" },
  { id: 3, name: "Masala Dosa", description: "Crispy dosa with chutney and sambar", price: 99, emoji: "🥞" },
  { id: 4, name: "Veg Biryani", description: "Fragrant rice with vegetables and spices", price: 179, emoji: "🍛" }
];

const appState = {
  cart: [],
  currentOrder: null,
  nextOrderId: 1
};

// ---------- OBSERVER PATTERN ----------
// Subject keeps a list of observers and notifies them about order events.
class OrderSubject {
  constructor() {
    this.observers = [];
  }
  subscribe(observer) {
    this.observers.push(observer);
  }
  unsubscribe(observer) {
    this.observers = this.observers.filter(item => item !== observer);
  }
  notify(eventName, order) {
    this.observers.forEach(observer => observer.update(eventName, order));
  }
}

class RestaurantObserver {
  update(eventName, order) {
    addNotification("Restaurant", `${eventName}: order #${order.id} (${order.items.length} item type(s)).`);
  }
}

class DeliveryAgentObserver {
  update(eventName, order) {
    addNotification("Delivery agent", `${eventName}: order #${order.id}. Delivery option: ${order.strategyName}.`);
  }
}

const orderEvents = new OrderSubject();
orderEvents.subscribe(new RestaurantObserver());
orderEvents.subscribe(new DeliveryAgentObserver());

// ---------- STRATEGY PATTERN ----------
// Each strategy implements the same calculateFee() operation.
class StandardDelivery {
  calculateFee() { return 30; }
  getName() { return "Standard delivery"; }
}
class ExpressDelivery {
  calculateFee() { return 60; }
  getName() { return "Express delivery"; }
}
class FreeDelivery {
  calculateFee() { return 0; }
  getName() { return "Free delivery coupon"; }
}

class DeliveryFeeContext {
  constructor(strategy) {
    this.strategy = strategy;
  }
  setStrategy(strategy) {
    this.strategy = strategy;
  }
  calculateFee() {
    return this.strategy.calculateFee();
  }
  getStrategyName() {
    return this.strategy.getName();
  }
}

function getSelectedStrategy() {
  const selected = document.getElementById("deliveryStrategy").value;
  if (selected === "express") return new ExpressDelivery();
  if (selected === "free") return new FreeDelivery();
  return new StandardDelivery();
}

function getSubtotal() {
  return appState.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

function money(amount) {
  return `₹${amount}`;
}

function renderMenu() {
  const menu = document.getElementById("menu");
  menu.innerHTML = menuItems.map(item => `
    <article class="food-card">
      <div class="food-emoji" aria-hidden="true">${item.emoji}</div>
      <h3>${item.name}</h3>
      <p class="description">${item.description}</p>
      <div class="food-bottom">
        <span class="price">${money(item.price)}</span>
        <button class="add-btn" data-add="${item.id}">Add +</button>
      </div>
    </article>
  `).join("");

  menu.querySelectorAll("[data-add]").forEach(button => {
    button.addEventListener("click", () => addToCart(Number(button.dataset.add)));
  });
}

function renderCart() {
  const cart = document.getElementById("cart");
  if (appState.cart.length === 0) {
    cart.innerHTML = '<p class="muted">Your cart is empty. Add a dish to begin.</p>';
  } else {
    cart.innerHTML = appState.cart.map(item => `
      <div class="cart-item">
        <div>${item.name}<small>${item.quantity} × ${money(item.price)}</small></div>
        <div><strong>${money(item.quantity * item.price)}</strong>
          <button class="remove-btn" data-remove="${item.id}" aria-label="Remove one ${item.name}">−</button>
        </div>
      </div>
    `).join("");
    cart.querySelectorAll("[data-remove]").forEach(button => {
      button.addEventListener("click", () => removeOneFromCart(Number(button.dataset.remove)));
    });
  }
  updateBill();
}

function updateBill() {
  const subtotal = getSubtotal();
  const delivery = new DeliveryFeeContext(getSelectedStrategy());
  const fee = appState.cart.length ? delivery.calculateFee() : 0;
  document.getElementById("subtotal").textContent = money(subtotal);
  document.getElementById("deliveryFee").textContent = money(fee);
  document.getElementById("total").textContent = money(subtotal + fee);
  document.getElementById("placeOrderBtn").disabled = appState.cart.length === 0;
}

function addToCart(itemId) {
  const item = menuItems.find(food => food.id === itemId);
  const existing = appState.cart.find(food => food.id === itemId);
  if (existing) existing.quantity += 1;
  else appState.cart.push({ ...item, quantity: 1 });
  renderCart();
  setStatus(`${item.name} added to your cart.`);
}

function removeOneFromCart(itemId) {
  const existing = appState.cart.find(food => food.id === itemId);
  if (!existing) return;
  existing.quantity -= 1;
  if (existing.quantity <= 0) appState.cart = appState.cart.filter(food => food.id !== itemId);
  renderCart();
}

// ---------- COMMAND PATTERN ----------
// A command object wraps an action. execute() performs it; undo() reverses it when possible.
class PlaceOrderCommand {
  constructor() {
    this.previousOrder = null;
    this.placedOrder = null;
  }
  execute() {
    if (appState.cart.length === 0) {
      setStatus("Add at least one menu item before placing an order.");
      return false;
    }
    this.previousOrder = appState.currentOrder;
    const strategy = new DeliveryFeeContext(getSelectedStrategy());
    const itemsSnapshot = appState.cart.map(item => ({ ...item }));
    const subtotal = itemsSnapshot.reduce((sum, item) => sum + item.price * item.quantity, 0);

    this.placedOrder = {
      id: appState.nextOrderId++,
      items: itemsSnapshot,
      subtotal,
      deliveryFee: strategy.calculateFee(),
      total: subtotal + strategy.calculateFee(),
      strategyName: strategy.getStrategyName(),
      status: "Placed"
    };
    appState.currentOrder = this.placedOrder;
    appState.cart = [];
    renderCart();
    setStatus(`Order #${this.placedOrder.id} placed. Total: ${money(this.placedOrder.total)}.`);
    orderEvents.notify("New order placed", this.placedOrder);
    return true;
  }
  undo() {
    if (!this.placedOrder || appState.currentOrder !== this.placedOrder) {
      setStatus("Cannot undo this place-order action because the order has changed.");
      return false;
    }
    appState.cart = this.placedOrder.items.map(item => ({ ...item }));
    appState.currentOrder = this.previousOrder;
    renderCart();
    setStatus(`Undo complete: order #${this.placedOrder.id} was removed and its items returned to the cart.`);
    orderEvents.notify("Order placement undone", this.placedOrder);
    return true;
  }
}

class CancelOrderCommand {
  constructor() {
    this.order = null;
    this.previousStatus = null;
  }
  execute() {
    const order = appState.currentOrder;
    if (!order || order.status === "Cancelled") {
      setStatus("There is no active order to cancel.");
      return false;
    }
    this.order = order;
    this.previousStatus = order.status;
    order.status = "Cancelled";
    setStatus(`Order #${order.id} cancelled.`);
    orderEvents.notify("Order cancelled", order);
    return true;
  }
  undo() {
    if (!this.order || appState.currentOrder !== this.order || this.order.status !== "Cancelled") {
      setStatus("Cannot undo cancellation now.");
      return false;
    }
    this.order.status = this.previousStatus;
    setStatus(`Undo complete: order #${this.order.id} status restored to "${this.order.status}".`);
    orderEvents.notify("Order cancellation undone", this.order);
    return true;
  }
}

class TrackOrderCommand {
  constructor() {
    this.order = null;
    this.previousStatus = null;
  }
  execute() {
    const order = appState.currentOrder;
    if (!order) {
      setStatus("Place an order first, then you can track it.");
      return false;
    }
    this.order = order;
    this.previousStatus = order.status;
    if (order.status === "Placed") order.status = "Preparing";
    else if (order.status === "Preparing") order.status = "Out for delivery";
    else if (order.status === "Out for delivery") order.status = "Delivered";
    setStatus(`Order #${order.id} status: ${order.status}.`);
    orderEvents.notify("Order tracking updated", order);
    return true;
  }
  undo() {
    if (!this.order || appState.currentOrder !== this.order || this.order.status === "Cancelled") {
      setStatus("Cannot undo tracking now.");
      return false;
    }
    this.order.status = this.previousStatus;
    setStatus(`Undo complete: tracking status restored to "${this.order.status}".`);
    orderEvents.notify("Order tracking update undone", this.order);
    return true;
  }
}

// Invoker receives a command and runs it without needing to know its internal details.
class OrderActionInvoker {
  constructor() {
    this.history = [];
  }
  executeCommand(command) {
    const succeeded = command.execute();
    if (succeeded) {
      this.history.push(command);
      document.getElementById("undoBtn").disabled = false;
    }
  }
  undoLastCommand() {
    const command = this.history.pop();
    if (!command) {
      setStatus("There is no action to undo.");
      return;
    }
    command.undo();
    document.getElementById("undoBtn").disabled = this.history.length === 0;
  }
}

const orderInvoker = new OrderActionInvoker();

// ---------- UI helpers ----------
function addNotification(observerName, message) {
  const list = document.getElementById("notifications");
  const empty = list.querySelector(".empty-log");
  if (empty) empty.remove();
  const item = document.createElement("li");
  const title = document.createElement("strong");
  title.textContent = observerName;
  const detail = document.createElement("span");
  detail.textContent = `${new Date().toLocaleTimeString()} — ${message}`;
  item.append(title, detail);
  list.prepend(item);
}

function setStatus(message) {
  document.getElementById("orderStatus").textContent = message;
}

// ---------- Event handlers ----------
document.getElementById("deliveryStrategy").addEventListener("change", updateBill);
document.getElementById("placeOrderBtn").addEventListener("click", () => {
  orderInvoker.executeCommand(new PlaceOrderCommand());
});
document.getElementById("cancelOrderBtn").addEventListener("click", () => {
  orderInvoker.executeCommand(new CancelOrderCommand());
});
document.getElementById("trackOrderBtn").addEventListener("click", () => {
  orderInvoker.executeCommand(new TrackOrderCommand());
});
document.getElementById("undoBtn").addEventListener("click", () => {
  orderInvoker.undoLastCommand();
});
document.getElementById("clearNotificationsBtn").addEventListener("click", () => {
  document.getElementById("notifications").innerHTML = '<li class="empty-log">Notifications will appear here.</li>';
});

// Initial render
renderMenu();
renderCart();
document.getElementById("undoBtn").disabled = true;

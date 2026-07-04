<script lang="ts">
  import type { Snippet } from 'svelte';
  import { onMount, setContext } from 'svelte';
  import WidgetIcon from '../WidgetIcon/WidgetIcon.svelte';
  import ChatHeader from '../ChatHeader/ChatHeader.svelte';
  import ChatWindow from '../ChatWindow/ChatWindow.svelte';
  import ChatInput from '../ChatInput/ChatInput.svelte';

  interface MenuItem {
    id: string;
    label: string;
    icon?: string;
    iconType?: 'svg' | 'emoji';
    type?: 'item' | 'section';
    onClick?: () => void;
  }

  interface ChatWidgetProps {
    isOpen?: boolean;
    position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
    expanded?: boolean;
    darkMode?: boolean;
    subheader?: Snippet;
    onToggle?: () => void;
    onExpand?: (expanded: boolean) => void;
    onSend?: (message: string) => void;
    onClose?: () => void;
    children?: Snippet;
    expandIcon?: 'grid' | 'arrows' | 'maximize' | 'chevrons' | 'plus-minus' | 'corner' | 'diagonal' | 'dots' | 'lines' | 'square';
    headerStyle?: 'flat' | 'wavy' | 'glass' | 'minimal' | 'none';
    menuItems?: MenuItem[];
    menuPosition?: 'left' | 'right';
    menuMode?: 'dropdown' | 'sidebar';
    onMenuItemClick?: (itemId: string) => void;
    title?: string;
    themeBackgroundColor?: string;
    headerBackgroundColor?: string;
    widgetButtonBackgroundColor?: string;
    launcherButtonBackgroundColor?: string;
    launcherButtonSize?: string;
    launcherButtonRadius?: string;
    launcherIconSrc?: string;
    launcherIconSize?: string;
    launcherPulse?: boolean;
    launcherCalloutText?: string;
    launcherCalloutAutoShow?: boolean;
    launcherCalloutDelayMs?: number;
    launcherCalloutAnimationMs?: number;
    launcherAriaLabel?: string;
    hideLauncher?: boolean;
    offsetX?: string;
    offsetY?: string;
    zIndex?: number;
    windowWidth?: string;
    windowHeight?: string;
    showBadge?: boolean;
    badgeCount?: number;
    onClearChat?: () => void;
    hasMessages?: boolean;
    clearButtonIcon?: 'trash' | 'x-circle' | 'refresh' | 'erase' | 'cross';
    showScrollButton?: boolean;
    panelOpen?: boolean;
    mode?: 'chat' | 'guided-flow';
    onModeToggle?: () => void;
    modeTogglePosition?: 'upper-left' | 'upper-right' | 'lower-left';
    guidedFlowConfig?: import('../GuidedFlow/types.js').GuidedFlowConfig;
    messagesCount?: number;
    noAssistantBubble?: boolean;
    iconSrc?: string;
    showInput?: boolean;
    ariaMessageLogLabel?: string;
    announceStreamingMode?: 'final-only' | 'incremental';
    announcementText?: string;
  }

  let {
    isOpen = false,
    position = 'bottom-right',
    expanded = false,
    darkMode = false,
    subheader,
    onToggle,
    onExpand,
    onSend,
    onClose,
    children,
    expandIcon = 'dots',
    headerStyle = 'wavy',
    menuItems,
    menuPosition = 'left',
    menuMode = 'sidebar',
    onMenuItemClick,
    title = 'Chat Support',
    themeBackgroundColor,
    headerBackgroundColor,
    widgetButtonBackgroundColor,
    launcherButtonBackgroundColor,
    launcherButtonSize = '60px',
    launcherButtonRadius,
    launcherIconSrc,
    launcherIconSize,
    launcherPulse = false,
    launcherCalloutText,
    launcherCalloutAutoShow = false,
    launcherCalloutDelayMs = 600,
    launcherCalloutAnimationMs = 800,
    launcherAriaLabel = 'Open chat widget',
    hideLauncher = false,
    offsetX = '20px',
    offsetY = '20px',
    zIndex = 2147483000,
    windowWidth = '426px',
    windowHeight = '702px',
    showBadge = true,
    badgeCount = 1,
    onClearChat,
    hasMessages = true,
    clearButtonIcon,
    showScrollButton = true,
    panelOpen = false,
    mode = 'chat',
    onModeToggle,
    modeTogglePosition = 'upper-left',
    guidedFlowConfig,
    messagesCount = 0,
    noAssistantBubble = false,
    iconSrc,
    showInput = true,
    ariaMessageLogLabel = 'Chat messages',
    announceStreamingMode = 'final-only',
    announcementText = ''
  }: ChatWidgetProps = $props();

  // Provide themeBackgroundColor to child components via context
  // Use a reactive store-like object that updates when themeBackgroundColor changes
  let themeContext = $state<{ value: string | undefined }>({ value: undefined });
  setContext('themeBackgroundColor', themeContext);
  
  // Update context when themeBackgroundColor prop changes
  $effect(() => {
    themeContext.value = themeBackgroundColor;
  });

  // Provide noAssistantBubble to child components via context
  let noAssistantBubbleContext = $state<{ value: boolean }>({ value: false });
  setContext('noAssistantBubble', noAssistantBubbleContext);
  
  // Update context when noAssistantBubble prop changes
  $effect(() => {
    noAssistantBubbleContext.value = noAssistantBubble;
  });

  // Use prop directly when parent controls it, otherwise use internal state
  let internalIsOpen = $state(false);
  let internalIsExpanded = $state(false);
  let widgetRootRef: HTMLDivElement | null = $state(null);
  let widgetWindowRef: HTMLDivElement | null = $state(null);
  let widgetButtonRef: HTMLButtonElement | null = $state(null);
  let previouslyFocusedElement: HTMLElement | null = $state(null);
  let wasWidgetOpen = $state(false);
  let launcherIconFailed = $state(false);
  let launcherCalloutVisible = $state(false);
  
  // If onToggle is provided, we're in controlled mode - use prop directly
  // Otherwise use internal state
  let isWidgetOpen = $derived(onToggle ? isOpen : internalIsOpen);
  let isExpanded = $derived(onExpand ? expanded : internalIsExpanded);

  let widgetClasses = $derived(
    [
      'chat-widget',
      `chat-widget--${position}`,
      isWidgetOpen && 'chat-widget--open',
      isExpanded && 'chat-widget--expanded',
      darkMode && 'chat-widget--dark',
      launcherPulse && !isWidgetOpen && 'chat-widget--launcher-pulse',
      `chat-widget--header-${headerStyle}`
    ]
      .filter(Boolean)
      .join(' ')
  );

  let widgetShellStyle = $derived(
    [
      `--chat-widget-z-index: ${zIndex};`,
      `--chat-widget-offset-x: ${offsetX};`,
      `--chat-widget-offset-y: ${offsetY};`,
      `--chat-widget-window-width: ${windowWidth};`,
      `--chat-widget-window-height: ${windowHeight};`,
      `--chat-widget-button-size: ${launcherButtonSize};`,
      `--chat-widget-button-bg: ${launcherButtonBackgroundColor ?? widgetButtonBackgroundColor ?? themeBackgroundColor ?? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'};`,
      launcherButtonRadius ? `--chat-widget-button-radius: ${launcherButtonRadius};` : '',
      launcherIconSize ? `--chat-widget-launcher-image-size: ${launcherIconSize};` : '',
      `--chat-widget-launcher-callout-animation-duration: ${Math.max(0, launcherCalloutAnimationMs)}ms;`
    ].join(' ')
  );

  onMount(() => {
    if (!launcherCalloutText || !launcherCalloutAutoShow || hideLauncher) return;
    const timeout = window.setTimeout(() => {
      launcherCalloutVisible = true;
    }, Math.max(0, launcherCalloutDelayMs));

    return () => window.clearTimeout(timeout);
  });

  $effect(() => {
    if (isWidgetOpen) {
      launcherCalloutVisible = false;
    }
  });

  function toggleWidget() {
    launcherCalloutVisible = false;
    if (!isWidgetOpen && typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      previouslyFocusedElement = document.activeElement;
    }
    if (onToggle) {
      // Controlled mode: update parent via callback
      onToggle();
    } else {
      // Uncontrolled mode: update internal state
      internalIsOpen = !internalIsOpen;
    }
  }

  function handleExpand(expanded: boolean) {
    if (onExpand) {
      // Controlled mode: update parent via callback
      onExpand(expanded);
    } else {
      // Uncontrolled mode: update internal state
      internalIsExpanded = expanded;
    }
  }

  function handleClose() {
    if (onExpand) {
      onExpand(false);
    } else {
      internalIsExpanded = false;
    }

    if (onToggle) {
      if (onClose) {
        onClose();
      } else {
        onToggle();
      }
      return;
    }

    internalIsOpen = false;
    onClose?.();
  }

  function handleSend(message: string) {
    onSend?.(message);
  }

  function getWidgetFocusableElements(): HTMLElement[] {
    if (!widgetWindowRef) return [];
    const selectors = [
      'button:not([disabled])',
      'a[href]',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])'
    ].join(',');
    return Array.from(widgetWindowRef.querySelectorAll<HTMLElement>(selectors)).filter((el) => {
      return !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true';
    });
  }

  function getPreferredOpenFocusTarget(): HTMLElement | null {
    if (!widgetWindowRef) return null;

    const preferredSelectors = [
      'textarea[aria-label="Message input"]',
      'input[aria-label="Message input"]',
      '.chat-header__close',
      '.chat-header__menu-button'
    ];

    for (const selector of preferredSelectors) {
      const preferredTarget = widgetWindowRef.querySelector<HTMLElement>(selector);
      if (
        preferredTarget &&
        !preferredTarget.hasAttribute('disabled') &&
        preferredTarget.getAttribute('aria-hidden') !== 'true'
      ) {
        return preferredTarget;
      }
    }

    const [firstFocusable] = getWidgetFocusableElements();
    return firstFocusable ?? null;
  }

  function handleLauncherIconError() {
    launcherIconFailed = true;
  }

  function dismissLauncherCallout(event: MouseEvent) {
    event.stopPropagation();
    launcherCalloutVisible = false;
  }

  $effect(() => {
    launcherIconSrc;
    launcherIconFailed = false;
  });

  $effect(() => {
    if (!isWidgetOpen || panelOpen) return;
    const root = widgetRootRef?.getRootNode();
    if (!(root instanceof ShadowRoot)) return;

    requestAnimationFrame(() => {
      getPreferredOpenFocusTarget()?.focus();
    });

    function handleKeydown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusables = getWidgetFocusableElements();
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const activeElement = root.activeElement as HTMLElement | null;
      const activeWithinWidget = activeElement ? widgetWindowRef?.contains(activeElement) : false;

      if (!activeWithinWidget) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
      if (!event.shiftKey && activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    }

    root.addEventListener('keydown', handleKeydown);
    return () => {
      root.removeEventListener('keydown', handleKeydown);
    };
  });

  $effect(() => {
    if (isWidgetOpen && !wasWidgetOpen && typeof document !== 'undefined') {
      const activeElement = document.activeElement;
      if (
        activeElement instanceof HTMLElement &&
        activeElement !== widgetButtonRef &&
        !widgetRootRef?.contains(activeElement)
      ) {
        previouslyFocusedElement = activeElement;
      }
    }

    if (!isWidgetOpen && wasWidgetOpen) {
      requestAnimationFrame(() => {
        (previouslyFocusedElement ?? widgetButtonRef)?.focus();
        previouslyFocusedElement = null;
      });
    }
    wasWidgetOpen = isWidgetOpen;
  });
</script>

  <div
    class={widgetClasses}
    data-theme={darkMode ? 'dark' : 'light'}
    bind:this={widgetRootRef}
    style={widgetShellStyle}
  >
  {#if isWidgetOpen}
    <div
      class="chat-widget__window"
      bind:this={widgetWindowRef}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <ChatHeader
        title={title}
        style={headerStyle}
        darkMode={darkMode}
        onClose={handleClose}
        menuItems={menuItems}
        menuPosition={menuPosition}
        menuMode={menuMode}
        onMenuItemClick={onMenuItemClick}
        headerBackgroundColor={headerBackgroundColor ?? themeBackgroundColor}
        height="lg"
        {iconSrc}
      />
      
      <ChatWindow
        expanded={isExpanded}
        onExpand={handleExpand}
        subheader={subheader}
        {showScrollButton}
        expandIcon={expandIcon}
        onClearChat={onClearChat}
        {hasMessages}
        clearButtonIcon={clearButtonIcon}
        {mode}
        onModeToggle={onModeToggle}
        modeTogglePosition={modeTogglePosition}
        guidedFlowConfig={guidedFlowConfig}
        messagesCount={messagesCount}
        onSend={onSend}
        noAssistantBubble={noAssistantBubble}
        {panelOpen}
        {ariaMessageLogLabel}
        {announceStreamingMode}
        {announcementText}
      >
        {#if children}
          {@render children()}
        {/if}
      </ChatWindow>

      {#if mode === 'chat' && !isExpanded && showInput}
        <div class="chat-widget__input-wrapper">
          <ChatInput
            placeholder="Type a message..."
            onsend={handleSend}
          />
        </div>
      {/if}
    </div>
  {/if}
  
  {#if !hideLauncher}
    {#if launcherCalloutText && launcherCalloutVisible && !isWidgetOpen}
      <div class="chat-widget__launcher-callout" role="group" aria-label="Chat prompt">
        <button
          class="chat-widget__launcher-callout-action"
          type="button"
          onclick={toggleWidget}
        >
          {launcherCalloutText}
        </button>
        <button
          class="chat-widget__launcher-callout-close"
          type="button"
          aria-label="Dismiss chat prompt"
          onclick={dismissLauncherCallout}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M18 6L6 18M6 6L18 18"
              stroke="currentColor"
              stroke-width="2.4"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      </div>
    {/if}

    <button
      bind:this={widgetButtonRef}
      class="chat-widget__button"
      onclick={toggleWidget}
      aria-label={isWidgetOpen ? 'Close chat' : launcherAriaLabel}
      aria-expanded={isWidgetOpen}
      aria-haspopup="dialog"
      type="button"
    >
      {#if isWidgetOpen}
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M18 6L6 18M6 6L18 18"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      {:else if launcherIconSrc && !launcherIconFailed}
        <img
          class="chat-widget__launcher-icon"
          src={launcherIconSrc}
          alt=""
          aria-hidden="true"
          onerror={handleLauncherIconError}
        />
        {#if showBadge}
          <span class="chat-widget__badge">{badgeCount}</span>
        {/if}
      {:else}
        <WidgetIcon type="message-bubble" size="md" color="#ffffff" />
        {#if showBadge}
          <span class="chat-widget__badge">{badgeCount}</span>
        {/if}
      {/if}
    </button>
  {/if}
</div>

<style>
  .chat-widget {
    position: fixed;
    z-index: var(--chat-widget-z-index, 2147483000);
    --chat-widget-button-size: 60px;
    --chat-widget-button-radius: 50%;
    --chat-widget-launcher-icon-size: clamp(24px, calc(var(--chat-widget-button-size, 60px) * 0.42), 44px);
    --chat-widget-launcher-image-size: clamp(44px, calc(var(--chat-widget-button-size, 60px) * 0.72), 72px);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
  }

  /* Position variants */
  .chat-widget--bottom-right {
    bottom: var(--chat-widget-offset-y, 20px);
    right: var(--chat-widget-offset-x, 20px);
  }

  .chat-widget--bottom-left {
    bottom: var(--chat-widget-offset-y, 20px);
    left: var(--chat-widget-offset-x, 20px);
  }

  .chat-widget--top-right {
    top: var(--chat-widget-offset-y, 20px);
    right: var(--chat-widget-offset-x, 20px);
  }

  .chat-widget--top-left {
    top: var(--chat-widget-offset-y, 20px);
    left: var(--chat-widget-offset-x, 20px);
  }

  /* Widget button */
  .chat-widget__button {
    position: relative;
    width: var(--chat-widget-button-size);
    height: var(--chat-widget-button-size);
    border-radius: var(--chat-widget-button-radius);
    background: var(--chat-widget-button-bg, linear-gradient(135deg, #3b82f6 0%, #2563eb 100%));
    border: none;
    box-shadow: 0 8px 24px rgba(59, 130, 246, 0.4), 0 4px 12px rgba(0, 0, 0, 0.15);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    color: #ffffff;
    padding: 0;
    overflow: visible;
  }

  .chat-widget--launcher-pulse:not(.chat-widget--open) .chat-widget__button {
    animation: chat-widget-launcher-pulse 2.8s ease-in-out infinite;
  }

  .chat-widget__button:hover {
    transform: scale(1.1);
    box-shadow: 0 12px 32px rgba(59, 130, 246, 0.5), 0 6px 16px rgba(0, 0, 0, 0.2);
  }

  .chat-widget__button:active {
    transform: scale(0.95);
  }

  .chat-widget__button:focus-visible {
    outline: 3px solid rgba(59, 130, 246, 0.5);
    outline-offset: 4px;
  }

  .chat-widget__button > svg,
  .chat-widget__button :global(.widget-icon),
  .chat-widget__button :global(.widget-icon svg) {
    width: var(--chat-widget-launcher-icon-size);
    height: var(--chat-widget-launcher-icon-size);
  }

  .chat-widget__launcher-icon {
    width: var(--chat-widget-launcher-image-size);
    height: var(--chat-widget-launcher-image-size);
    object-fit: contain;
    display: block;
    border-radius: var(--chat-widget-button-radius);
    pointer-events: none;
  }

  .chat-widget__launcher-callout {
    position: absolute;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: min(230px, calc(100vw - var(--chat-widget-button-size) - var(--chat-widget-offset-x, 20px) - 24px));
    max-width: min(292px, calc(100vw - var(--chat-widget-button-size) - var(--chat-widget-offset-x, 20px) - 24px));
    min-height: calc(var(--chat-widget-button-size) * 0.58);
    padding: 6px 7px 6px 13px;
    background: var(--chat-widget-button-bg, #38BDF8);
    color: #082F49;
    border-radius: 999px;
    box-shadow: 0 9px 18px rgba(0, 0, 0, 0.18), 0 3px 8px rgba(0, 0, 0, 0.12);
    box-sizing: border-box;
    isolation: isolate;
    opacity: 0;
    transform: translateY(12px) scaleX(0.72);
    animation: chat-widget-callout-in var(--chat-widget-launcher-callout-animation-duration, 800ms) cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  .chat-widget--bottom-left .chat-widget__launcher-callout {
    bottom: calc(var(--chat-widget-button-size) - 4px);
    left: calc(var(--chat-widget-button-size) - 2px);
    transform-origin: left bottom;
  }

  .chat-widget--bottom-right .chat-widget__launcher-callout {
    bottom: calc(var(--chat-widget-button-size) - 4px);
    right: calc(var(--chat-widget-button-size) - 2px);
    transform-origin: right bottom;
  }

  .chat-widget--top-left .chat-widget__launcher-callout {
    top: calc(var(--chat-widget-button-size) - 4px);
    left: calc(var(--chat-widget-button-size) - 2px);
    transform-origin: left top;
  }

  .chat-widget--top-right .chat-widget__launcher-callout {
    top: calc(var(--chat-widget-button-size) - 4px);
    right: calc(var(--chat-widget-button-size) - 2px);
    transform-origin: right top;
  }

  .chat-widget__launcher-callout::before {
    content: '';
    position: absolute;
    z-index: -1;
    width: 18px;
    height: 16px;
    background: var(--chat-widget-button-bg, #38BDF8);
    border-radius: 2px;
  }

  .chat-widget--bottom-left .chat-widget__launcher-callout::before {
    left: -6px;
    bottom: 1px;
    clip-path: polygon(0 100%, 100% 18%, 100% 80%);
  }

  .chat-widget--bottom-right .chat-widget__launcher-callout::before {
    right: -6px;
    bottom: 1px;
    clip-path: polygon(100% 100%, 0 18%, 0 80%);
  }

  .chat-widget--top-left .chat-widget__launcher-callout::before {
    left: -6px;
    top: 1px;
    clip-path: polygon(0 0, 100% 20%, 100% 82%);
  }

  .chat-widget--top-right .chat-widget__launcher-callout::before {
    right: -6px;
    top: 1px;
    clip-path: polygon(100% 0, 0 20%, 0 82%);
  }

  .chat-widget__launcher-callout-action,
  .chat-widget__launcher-callout-close {
    border: 0;
    cursor: pointer;
    font: inherit;
  }

  .chat-widget__launcher-callout-action {
    min-width: 0;
    padding: 0;
    background: transparent;
    color: inherit;
    font-size: clamp(13px, calc(var(--chat-widget-button-size) * 0.23), 17px);
    line-height: 1.15;
    text-align: left;
    white-space: nowrap;
    letter-spacing: 0;
  }

  .chat-widget__launcher-callout-close {
    flex: 0 0 auto;
    width: clamp(22px, calc(var(--chat-widget-button-size) * 0.32), 27px);
    height: clamp(22px, calc(var(--chat-widget-button-size) * 0.32), 27px);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    color: #082F49;
    padding: 0;
  }

  .chat-widget__launcher-callout-action:focus-visible,
  .chat-widget__launcher-callout-close:focus-visible {
    outline: 3px solid rgba(8, 47, 73, 0.35);
    outline-offset: 3px;
  }

  @keyframes chat-widget-launcher-pulse {
    0%, 72%, 100% {
      transform: scale(1);
      box-shadow: 0 8px 24px rgba(56, 189, 248, 0.4), 0 4px 12px rgba(0, 0, 0, 0.15), 0 0 0 0 rgba(56, 189, 248, 0);
    }
    18% {
      transform: scale(1.045);
      box-shadow: 0 10px 26px rgba(56, 189, 248, 0.34), 0 5px 14px rgba(0, 0, 0, 0.16), 0 0 0 7px rgba(56, 189, 248, 0.22);
    }
    36% {
      transform: scale(1);
      box-shadow: 0 8px 24px rgba(56, 189, 248, 0.4), 0 4px 12px rgba(0, 0, 0, 0.15), 0 0 0 13px rgba(56, 189, 248, 0);
    }
  }

  @keyframes chat-widget-callout-in {
    from {
      opacity: 0;
      transform: translateY(12px) scaleX(0.72);
    }
    to {
      opacity: 1;
      transform: translateY(0) scaleX(1);
    }
  }

  /* Badge */
  .chat-widget__badge {
    position: absolute;
    top: -4px;
    right: -4px;
    background: #ef4444;
    color: #ffffff;
    font-size: 12px;
    font-weight: 600;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid #ffffff;
    box-shadow: 0 2px 8px rgba(239, 68, 68, 0.4);
  }

  /* Chat window */
  .chat-widget__window {
    position: absolute;
    bottom: calc(var(--chat-widget-button-size) + 20px);
    right: 0;
    width: var(--chat-widget-window-width, 426px);
    max-width: calc(100vw - (2 * var(--chat-widget-offset-x, 20px)));
    height: var(--chat-widget-window-height, 702px);
    max-height: calc(100vh - (2 * var(--chat-widget-offset-y, 20px)) - var(--chat-widget-button-size) - 20px);
    background: #ffffff;
    border-radius: 6px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2), 0 8px 24px rgba(0, 0, 0, 0.15);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: chat-widget-slide-up 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    border: 1px solid rgba(0, 0, 0, 0.05);
    /* Provide positioning context for contained menus - window is already positioned, so it creates containing block */
  }

  .chat-widget--bottom-left .chat-widget__window {
    bottom: calc(var(--chat-widget-button-size) + 20px);
    left: 0;
    right: auto;
  }

  .chat-widget--top-right .chat-widget__window {
    bottom: auto;
    top: calc(var(--chat-widget-button-size) + 20px);
    right: 0;
  }

  .chat-widget--top-left .chat-widget__window {
    bottom: auto;
    top: calc(var(--chat-widget-button-size) + 20px);
    left: 0;
    right: auto;
  }

  .chat-widget--expanded .chat-widget__window {
    width: min(1200px, calc(100vw - (2 * var(--chat-widget-offset-x, 20px))));
    height: min(900px, calc(100vh - (2 * var(--chat-widget-offset-y, 20px)) - var(--chat-widget-button-size) - 20px));
    max-width: calc(100vw - (2 * var(--chat-widget-offset-x, 20px)));
    max-height: calc(100vh - (2 * var(--chat-widget-offset-y, 20px)) - var(--chat-widget-button-size) - 20px);
    transform-origin: bottom right;
    animation: expand-widget 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .chat-widget--bottom-left.chat-widget--expanded .chat-widget__window {
    transform-origin: bottom left;
  }

  .chat-widget--top-left.chat-widget--expanded .chat-widget__window {
    transform-origin: top left;
  }

  .chat-widget--bottom-right.chat-widget--expanded .chat-widget__window {
    transform-origin: bottom right;
  }

  .chat-widget--top-right.chat-widget--expanded .chat-widget__window {
    transform-origin: top right;
  }

  @keyframes expand-widget {
    from {
      opacity: 0;
      transform: scale(0.97);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  @keyframes chat-widget-slide-up {
    from {
      opacity: 0;
      transform: translateY(20px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }


  /* Input wrapper */
  .chat-widget__input-wrapper {
    flex-shrink: 0;
    padding: 16px;
    background: rgba(249, 250, 251, 0.95);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border-top: 1px solid rgba(0, 0, 0, 0.05);
    z-index: 10;
    position: relative;
  }

  /* Hide input wrapper when expanded (input is now inside ChatWindow) */
  .chat-widget--expanded .chat-widget__input-wrapper {
    display: none !important;
  }

  /* Dark mode */
  :global(.dark) .chat-widget__window,
  :global([data-theme="dark"]) .chat-widget__window,
  .chat-widget--dark .chat-widget__window {
    background: #1e1e1e;
  }

  :global(.dark) .chat-widget__input-wrapper,
  :global([data-theme="dark"]) .chat-widget__input-wrapper,
  .chat-widget--dark .chat-widget__input-wrapper {
    background: rgba(30, 30, 30, 0.95);
    border-top-color: rgba(255, 255, 255, 0.1);
  }

  /* Responsive */
  @media (max-width: 968px) {
    .chat-widget--expanded .chat-widget__window {
      width: min(1200px, calc(100vw - (2 * var(--chat-widget-offset-x, 20px))));
      height: min(900px, calc(100vh - (2 * var(--chat-widget-offset-y, 20px)) - var(--chat-widget-button-size) - 20px));
    }
  }

  @media (max-width: 640px) {
    /* Button positioning when widget is NOT open */
    .chat-widget--bottom-right,
    .chat-widget--bottom-left {
      bottom: var(--chat-widget-offset-y, 10px);
      right: var(--chat-widget-offset-x, 10px);
      left: auto;
    }

    .chat-widget--bottom-left {
      left: var(--chat-widget-offset-x, 10px);
      right: auto;
    }

    /* When open: parent covers full viewport as backdrop (must come AFTER position rules to win specificity) */
    .chat-widget--open {
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      width: 100%;
      height: 100%;
      background: #000;
    }

    .chat-widget--dark.chat-widget--open {
      background: #1e1e1e;
    }

    /* Child fills parent (absolute, not fixed — avoids nested fixed positioning issues on iOS) */
    .chat-widget--open .chat-widget__window {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      width: auto;
      height: auto;
      max-width: none;
      max-height: none;
      border-radius: 0;
      border: none;
      animation: none;
      overscroll-behavior: none;
    }

    /* Hide floating bubble when widget is open on mobile */
    .chat-widget--open .chat-widget__button {
      display: none;
    }

    .chat-widget__launcher-callout {
      width: min(230px, calc(100vw - var(--chat-widget-button-size) - var(--chat-widget-offset-x, 10px) - 18px));
      max-width: min(292px, calc(100vw - var(--chat-widget-button-size) - var(--chat-widget-offset-x, 10px) - 18px));
    }

    /* Expanded state on mobile: same fullscreen treatment */
    .chat-widget--expanded .chat-widget__window {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      width: auto;
      height: auto;
      max-width: none;
      max-height: none;
      border-radius: 0;
      border: none;
      transform: none;
      overscroll-behavior: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .chat-widget,
    .chat-widget * {
      animation: none !important;
      transition: none !important;
    }
  }
</style>

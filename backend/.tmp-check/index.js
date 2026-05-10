var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// node_modules/hono/dist/compose.js
var compose = /* @__PURE__ */ __name((middleware, onError, onNotFound) => {
  return (context, next) => {
    let index = -1;
    return dispatch(0);
    async function dispatch(i) {
      if (i <= index) {
        throw new Error("next() called multiple times");
      }
      index = i;
      let res;
      let isError = false;
      let handler;
      if (middleware[i]) {
        handler = middleware[i][0][0];
        context.req.routeIndex = i;
      } else {
        handler = i === middleware.length && next || void 0;
      }
      if (handler) {
        try {
          res = await handler(context, () => dispatch(i + 1));
        } catch (err) {
          if (err instanceof Error && onError) {
            context.error = err;
            res = await onError(err, context);
            isError = true;
          } else {
            throw err;
          }
        }
      } else {
        if (context.finalized === false && onNotFound) {
          res = await onNotFound(context);
        }
      }
      if (res && (context.finalized === false || isError)) {
        context.res = res;
      }
      return context;
    }
    __name(dispatch, "dispatch");
  };
}, "compose");

// node_modules/hono/dist/request/constants.js
var GET_MATCH_RESULT = /* @__PURE__ */ Symbol();

// node_modules/hono/dist/utils/body.js
var parseBody = /* @__PURE__ */ __name(async (request, options = /* @__PURE__ */ Object.create(null)) => {
  const { all = false, dot = false } = options;
  const headers = request instanceof HonoRequest ? request.raw.headers : request.headers;
  const contentType = headers.get("Content-Type");
  if (contentType?.startsWith("multipart/form-data") || contentType?.startsWith("application/x-www-form-urlencoded")) {
    return parseFormData(request, { all, dot });
  }
  return {};
}, "parseBody");
async function parseFormData(request, options) {
  const formData = await request.formData();
  if (formData) {
    return convertFormDataToBodyData(formData, options);
  }
  return {};
}
__name(parseFormData, "parseFormData");
function convertFormDataToBodyData(formData, options) {
  const form = /* @__PURE__ */ Object.create(null);
  formData.forEach((value, key) => {
    const shouldParseAllValues = options.all || key.endsWith("[]");
    if (!shouldParseAllValues) {
      form[key] = value;
    } else {
      handleParsingAllValues(form, key, value);
    }
  });
  if (options.dot) {
    Object.entries(form).forEach(([key, value]) => {
      const shouldParseDotValues = key.includes(".");
      if (shouldParseDotValues) {
        handleParsingNestedValues(form, key, value);
        delete form[key];
      }
    });
  }
  return form;
}
__name(convertFormDataToBodyData, "convertFormDataToBodyData");
var handleParsingAllValues = /* @__PURE__ */ __name((form, key, value) => {
  if (form[key] !== void 0) {
    if (Array.isArray(form[key])) {
      ;
      form[key].push(value);
    } else {
      form[key] = [form[key], value];
    }
  } else {
    if (!key.endsWith("[]")) {
      form[key] = value;
    } else {
      form[key] = [value];
    }
  }
}, "handleParsingAllValues");
var handleParsingNestedValues = /* @__PURE__ */ __name((form, key, value) => {
  if (/(?:^|\.)__proto__\./.test(key)) {
    return;
  }
  let nestedForm = form;
  const keys = key.split(".");
  keys.forEach((key2, index) => {
    if (index === keys.length - 1) {
      nestedForm[key2] = value;
    } else {
      if (!nestedForm[key2] || typeof nestedForm[key2] !== "object" || Array.isArray(nestedForm[key2]) || nestedForm[key2] instanceof File) {
        nestedForm[key2] = /* @__PURE__ */ Object.create(null);
      }
      nestedForm = nestedForm[key2];
    }
  });
}, "handleParsingNestedValues");

// node_modules/hono/dist/utils/url.js
var splitPath = /* @__PURE__ */ __name((path) => {
  const paths = path.split("/");
  if (paths[0] === "") {
    paths.shift();
  }
  return paths;
}, "splitPath");
var splitRoutingPath = /* @__PURE__ */ __name((routePath) => {
  const { groups, path } = extractGroupsFromPath(routePath);
  const paths = splitPath(path);
  return replaceGroupMarks(paths, groups);
}, "splitRoutingPath");
var extractGroupsFromPath = /* @__PURE__ */ __name((path) => {
  const groups = [];
  path = path.replace(/\{[^}]+\}/g, (match2, index) => {
    const mark = `@${index}`;
    groups.push([mark, match2]);
    return mark;
  });
  return { groups, path };
}, "extractGroupsFromPath");
var replaceGroupMarks = /* @__PURE__ */ __name((paths, groups) => {
  for (let i = groups.length - 1; i >= 0; i--) {
    const [mark] = groups[i];
    for (let j = paths.length - 1; j >= 0; j--) {
      if (paths[j].includes(mark)) {
        paths[j] = paths[j].replace(mark, groups[i][1]);
        break;
      }
    }
  }
  return paths;
}, "replaceGroupMarks");
var patternCache = {};
var getPattern = /* @__PURE__ */ __name((label, next) => {
  if (label === "*") {
    return "*";
  }
  const match2 = label.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
  if (match2) {
    const cacheKey = `${label}#${next}`;
    if (!patternCache[cacheKey]) {
      if (match2[2]) {
        patternCache[cacheKey] = next && next[0] !== ":" && next[0] !== "*" ? [cacheKey, match2[1], new RegExp(`^${match2[2]}(?=/${next})`)] : [label, match2[1], new RegExp(`^${match2[2]}$`)];
      } else {
        patternCache[cacheKey] = [label, match2[1], true];
      }
    }
    return patternCache[cacheKey];
  }
  return null;
}, "getPattern");
var tryDecode = /* @__PURE__ */ __name((str, decoder) => {
  try {
    return decoder(str);
  } catch {
    return str.replace(/(?:%[0-9A-Fa-f]{2})+/g, (match2) => {
      try {
        return decoder(match2);
      } catch {
        return match2;
      }
    });
  }
}, "tryDecode");
var tryDecodeURI = /* @__PURE__ */ __name((str) => tryDecode(str, decodeURI), "tryDecodeURI");
var getPath = /* @__PURE__ */ __name((request) => {
  const url = request.url;
  const start = url.indexOf("/", url.indexOf(":") + 4);
  let i = start;
  for (; i < url.length; i++) {
    const charCode = url.charCodeAt(i);
    if (charCode === 37) {
      const queryIndex = url.indexOf("?", i);
      const hashIndex = url.indexOf("#", i);
      const end = queryIndex === -1 ? hashIndex === -1 ? void 0 : hashIndex : hashIndex === -1 ? queryIndex : Math.min(queryIndex, hashIndex);
      const path = url.slice(start, end);
      return tryDecodeURI(path.includes("%25") ? path.replace(/%25/g, "%2525") : path);
    } else if (charCode === 63 || charCode === 35) {
      break;
    }
  }
  return url.slice(start, i);
}, "getPath");
var getPathNoStrict = /* @__PURE__ */ __name((request) => {
  const result = getPath(request);
  return result.length > 1 && result.at(-1) === "/" ? result.slice(0, -1) : result;
}, "getPathNoStrict");
var mergePath = /* @__PURE__ */ __name((base, sub, ...rest) => {
  if (rest.length) {
    sub = mergePath(sub, ...rest);
  }
  return `${base?.[0] === "/" ? "" : "/"}${base}${sub === "/" ? "" : `${base?.at(-1) === "/" ? "" : "/"}${sub?.[0] === "/" ? sub.slice(1) : sub}`}`;
}, "mergePath");
var checkOptionalParameter = /* @__PURE__ */ __name((path) => {
  if (path.charCodeAt(path.length - 1) !== 63 || !path.includes(":")) {
    return null;
  }
  const segments = path.split("/");
  const results = [];
  let basePath = "";
  segments.forEach((segment) => {
    if (segment !== "" && !/\:/.test(segment)) {
      basePath += "/" + segment;
    } else if (/\:/.test(segment)) {
      if (/\?/.test(segment)) {
        if (results.length === 0 && basePath === "") {
          results.push("/");
        } else {
          results.push(basePath);
        }
        const optionalSegment = segment.replace("?", "");
        basePath += "/" + optionalSegment;
        results.push(basePath);
      } else {
        basePath += "/" + segment;
      }
    }
  });
  return results.filter((v, i, a) => a.indexOf(v) === i);
}, "checkOptionalParameter");
var _decodeURI = /* @__PURE__ */ __name((value) => {
  if (!/[%+]/.test(value)) {
    return value;
  }
  if (value.indexOf("+") !== -1) {
    value = value.replace(/\+/g, " ");
  }
  return value.indexOf("%") !== -1 ? tryDecode(value, decodeURIComponent_) : value;
}, "_decodeURI");
var _getQueryParam = /* @__PURE__ */ __name((url, key, multiple) => {
  let encoded;
  if (!multiple && key && !/[%+]/.test(key)) {
    let keyIndex2 = url.indexOf("?", 8);
    if (keyIndex2 === -1) {
      return void 0;
    }
    if (!url.startsWith(key, keyIndex2 + 1)) {
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    while (keyIndex2 !== -1) {
      const trailingKeyCode = url.charCodeAt(keyIndex2 + key.length + 1);
      if (trailingKeyCode === 61) {
        const valueIndex = keyIndex2 + key.length + 2;
        const endIndex = url.indexOf("&", valueIndex);
        return _decodeURI(url.slice(valueIndex, endIndex === -1 ? void 0 : endIndex));
      } else if (trailingKeyCode == 38 || isNaN(trailingKeyCode)) {
        return "";
      }
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    encoded = /[%+]/.test(url);
    if (!encoded) {
      return void 0;
    }
  }
  const results = {};
  encoded ??= /[%+]/.test(url);
  let keyIndex = url.indexOf("?", 8);
  while (keyIndex !== -1) {
    const nextKeyIndex = url.indexOf("&", keyIndex + 1);
    let valueIndex = url.indexOf("=", keyIndex);
    if (valueIndex > nextKeyIndex && nextKeyIndex !== -1) {
      valueIndex = -1;
    }
    let name = url.slice(
      keyIndex + 1,
      valueIndex === -1 ? nextKeyIndex === -1 ? void 0 : nextKeyIndex : valueIndex
    );
    if (encoded) {
      name = _decodeURI(name);
    }
    keyIndex = nextKeyIndex;
    if (name === "") {
      continue;
    }
    let value;
    if (valueIndex === -1) {
      value = "";
    } else {
      value = url.slice(valueIndex + 1, nextKeyIndex === -1 ? void 0 : nextKeyIndex);
      if (encoded) {
        value = _decodeURI(value);
      }
    }
    if (multiple) {
      if (!(results[name] && Array.isArray(results[name]))) {
        results[name] = [];
      }
      ;
      results[name].push(value);
    } else {
      results[name] ??= value;
    }
  }
  return key ? results[key] : results;
}, "_getQueryParam");
var getQueryParam = _getQueryParam;
var getQueryParams = /* @__PURE__ */ __name((url, key) => {
  return _getQueryParam(url, key, true);
}, "getQueryParams");
var decodeURIComponent_ = decodeURIComponent;

// node_modules/hono/dist/request.js
var tryDecodeURIComponent = /* @__PURE__ */ __name((str) => tryDecode(str, decodeURIComponent_), "tryDecodeURIComponent");
var HonoRequest = class {
  static {
    __name(this, "HonoRequest");
  }
  /**
   * `.raw` can get the raw Request object.
   *
   * @see {@link https://hono.dev/docs/api/request#raw}
   *
   * @example
   * ```ts
   * // For Cloudflare Workers
   * app.post('/', async (c) => {
   *   const metadata = c.req.raw.cf?.hostMetadata?
   *   ...
   * })
   * ```
   */
  raw;
  #validatedData;
  // Short name of validatedData
  #matchResult;
  routeIndex = 0;
  /**
   * `.path` can get the pathname of the request.
   *
   * @see {@link https://hono.dev/docs/api/request#path}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const pathname = c.req.path // `/about/me`
   * })
   * ```
   */
  path;
  bodyCache = {};
  constructor(request, path = "/", matchResult = [[]]) {
    this.raw = request;
    this.path = path;
    this.#matchResult = matchResult;
    this.#validatedData = {};
  }
  param(key) {
    return key ? this.#getDecodedParam(key) : this.#getAllDecodedParams();
  }
  #getDecodedParam(key) {
    const paramKey = this.#matchResult[0][this.routeIndex][1][key];
    const param = this.#getParamValue(paramKey);
    return param && /\%/.test(param) ? tryDecodeURIComponent(param) : param;
  }
  #getAllDecodedParams() {
    const decoded = {};
    const keys = Object.keys(this.#matchResult[0][this.routeIndex][1]);
    for (const key of keys) {
      const value = this.#getParamValue(this.#matchResult[0][this.routeIndex][1][key]);
      if (value !== void 0) {
        decoded[key] = /\%/.test(value) ? tryDecodeURIComponent(value) : value;
      }
    }
    return decoded;
  }
  #getParamValue(paramKey) {
    return this.#matchResult[1] ? this.#matchResult[1][paramKey] : paramKey;
  }
  query(key) {
    return getQueryParam(this.url, key);
  }
  queries(key) {
    return getQueryParams(this.url, key);
  }
  header(name) {
    if (name) {
      return this.raw.headers.get(name) ?? void 0;
    }
    const headerData = {};
    this.raw.headers.forEach((value, key) => {
      headerData[key] = value;
    });
    return headerData;
  }
  async parseBody(options) {
    return parseBody(this, options);
  }
  #cachedBody = /* @__PURE__ */ __name((key) => {
    const { bodyCache, raw: raw2 } = this;
    const cachedBody = bodyCache[key];
    if (cachedBody) {
      return cachedBody;
    }
    const anyCachedKey = Object.keys(bodyCache)[0];
    if (anyCachedKey) {
      return bodyCache[anyCachedKey].then((body) => {
        if (anyCachedKey === "json") {
          body = JSON.stringify(body);
        }
        return new Response(body)[key]();
      });
    }
    return bodyCache[key] = raw2[key]();
  }, "#cachedBody");
  /**
   * `.json()` can parse Request body of type `application/json`
   *
   * @see {@link https://hono.dev/docs/api/request#json}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.json()
   * })
   * ```
   */
  json() {
    return this.#cachedBody("text").then((text) => JSON.parse(text));
  }
  /**
   * `.text()` can parse Request body of type `text/plain`
   *
   * @see {@link https://hono.dev/docs/api/request#text}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.text()
   * })
   * ```
   */
  text() {
    return this.#cachedBody("text");
  }
  /**
   * `.arrayBuffer()` parse Request body as an `ArrayBuffer`
   *
   * @see {@link https://hono.dev/docs/api/request#arraybuffer}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.arrayBuffer()
   * })
   * ```
   */
  arrayBuffer() {
    return this.#cachedBody("arrayBuffer");
  }
  /**
   * Parses the request body as a `Blob`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.blob();
   * });
   * ```
   * @see https://hono.dev/docs/api/request#blob
   */
  blob() {
    return this.#cachedBody("blob");
  }
  /**
   * Parses the request body as `FormData`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.formData();
   * });
   * ```
   * @see https://hono.dev/docs/api/request#formdata
   */
  formData() {
    return this.#cachedBody("formData");
  }
  /**
   * Adds validated data to the request.
   *
   * @param target - The target of the validation.
   * @param data - The validated data to add.
   */
  addValidatedData(target, data) {
    this.#validatedData[target] = data;
  }
  valid(target) {
    return this.#validatedData[target];
  }
  /**
   * `.url()` can get the request url strings.
   *
   * @see {@link https://hono.dev/docs/api/request#url}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const url = c.req.url // `http://localhost:8787/about/me`
   *   ...
   * })
   * ```
   */
  get url() {
    return this.raw.url;
  }
  /**
   * `.method()` can get the method name of the request.
   *
   * @see {@link https://hono.dev/docs/api/request#method}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const method = c.req.method // `GET`
   * })
   * ```
   */
  get method() {
    return this.raw.method;
  }
  get [GET_MATCH_RESULT]() {
    return this.#matchResult;
  }
  /**
   * `.matchedRoutes()` can return a matched route in the handler
   *
   * @deprecated
   *
   * Use matchedRoutes helper defined in "hono/route" instead.
   *
   * @see {@link https://hono.dev/docs/api/request#matchedroutes}
   *
   * @example
   * ```ts
   * app.use('*', async function logger(c, next) {
   *   await next()
   *   c.req.matchedRoutes.forEach(({ handler, method, path }, i) => {
   *     const name = handler.name || (handler.length < 2 ? '[handler]' : '[middleware]')
   *     console.log(
   *       method,
   *       ' ',
   *       path,
   *       ' '.repeat(Math.max(10 - path.length, 0)),
   *       name,
   *       i === c.req.routeIndex ? '<- respond from here' : ''
   *     )
   *   })
   * })
   * ```
   */
  get matchedRoutes() {
    return this.#matchResult[0].map(([[, route]]) => route);
  }
  /**
   * `routePath()` can retrieve the path registered within the handler
   *
   * @deprecated
   *
   * Use routePath helper defined in "hono/route" instead.
   *
   * @see {@link https://hono.dev/docs/api/request#routepath}
   *
   * @example
   * ```ts
   * app.get('/posts/:id', (c) => {
   *   return c.json({ path: c.req.routePath })
   * })
   * ```
   */
  get routePath() {
    return this.#matchResult[0].map(([[, route]]) => route)[this.routeIndex].path;
  }
};

// node_modules/hono/dist/utils/html.js
var HtmlEscapedCallbackPhase = {
  Stringify: 1,
  BeforeStream: 2,
  Stream: 3
};
var raw = /* @__PURE__ */ __name((value, callbacks) => {
  const escapedString = new String(value);
  escapedString.isEscaped = true;
  escapedString.callbacks = callbacks;
  return escapedString;
}, "raw");
var resolveCallback = /* @__PURE__ */ __name(async (str, phase, preserveCallbacks, context, buffer) => {
  if (typeof str === "object" && !(str instanceof String)) {
    if (!(str instanceof Promise)) {
      str = str.toString();
    }
    if (str instanceof Promise) {
      str = await str;
    }
  }
  const callbacks = str.callbacks;
  if (!callbacks?.length) {
    return Promise.resolve(str);
  }
  if (buffer) {
    buffer[0] += str;
  } else {
    buffer = [str];
  }
  const resStr = Promise.all(callbacks.map((c) => c({ phase, buffer, context }))).then(
    (res) => Promise.all(
      res.filter(Boolean).map((str2) => resolveCallback(str2, phase, false, context, buffer))
    ).then(() => buffer[0])
  );
  if (preserveCallbacks) {
    return raw(await resStr, callbacks);
  } else {
    return resStr;
  }
}, "resolveCallback");

// node_modules/hono/dist/context.js
var TEXT_PLAIN = "text/plain; charset=UTF-8";
var setDefaultContentType = /* @__PURE__ */ __name((contentType, headers) => {
  return {
    "Content-Type": contentType,
    ...headers
  };
}, "setDefaultContentType");
var createResponseInstance = /* @__PURE__ */ __name((body, init) => new Response(body, init), "createResponseInstance");
var Context = class {
  static {
    __name(this, "Context");
  }
  #rawRequest;
  #req;
  /**
   * `.env` can get bindings (environment variables, secrets, KV namespaces, D1 database, R2 bucket etc.) in Cloudflare Workers.
   *
   * @see {@link https://hono.dev/docs/api/context#env}
   *
   * @example
   * ```ts
   * // Environment object for Cloudflare Workers
   * app.get('*', async c => {
   *   const counter = c.env.COUNTER
   * })
   * ```
   */
  env = {};
  #var;
  finalized = false;
  /**
   * `.error` can get the error object from the middleware if the Handler throws an error.
   *
   * @see {@link https://hono.dev/docs/api/context#error}
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   await next()
   *   if (c.error) {
   *     // do something...
   *   }
   * })
   * ```
   */
  error;
  #status;
  #executionCtx;
  #res;
  #layout;
  #renderer;
  #notFoundHandler;
  #preparedHeaders;
  #matchResult;
  #path;
  /**
   * Creates an instance of the Context class.
   *
   * @param req - The Request object.
   * @param options - Optional configuration options for the context.
   */
  constructor(req, options) {
    this.#rawRequest = req;
    if (options) {
      this.#executionCtx = options.executionCtx;
      this.env = options.env;
      this.#notFoundHandler = options.notFoundHandler;
      this.#path = options.path;
      this.#matchResult = options.matchResult;
    }
  }
  /**
   * `.req` is the instance of {@link HonoRequest}.
   */
  get req() {
    this.#req ??= new HonoRequest(this.#rawRequest, this.#path, this.#matchResult);
    return this.#req;
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#event}
   * The FetchEvent associated with the current request.
   *
   * @throws Will throw an error if the context does not have a FetchEvent.
   */
  get event() {
    if (this.#executionCtx && "respondWith" in this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no FetchEvent");
    }
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#executionctx}
   * The ExecutionContext associated with the current request.
   *
   * @throws Will throw an error if the context does not have an ExecutionContext.
   */
  get executionCtx() {
    if (this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no ExecutionContext");
    }
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#res}
   * The Response object for the current request.
   */
  get res() {
    return this.#res ||= createResponseInstance(null, {
      headers: this.#preparedHeaders ??= new Headers()
    });
  }
  /**
   * Sets the Response object for the current request.
   *
   * @param _res - The Response object to set.
   */
  set res(_res) {
    if (this.#res && _res) {
      _res = createResponseInstance(_res.body, _res);
      for (const [k, v] of this.#res.headers.entries()) {
        if (k === "content-type") {
          continue;
        }
        if (k === "set-cookie") {
          const cookies = this.#res.headers.getSetCookie();
          _res.headers.delete("set-cookie");
          for (const cookie of cookies) {
            _res.headers.append("set-cookie", cookie);
          }
        } else {
          _res.headers.set(k, v);
        }
      }
    }
    this.#res = _res;
    this.finalized = true;
  }
  /**
   * `.render()` can create a response within a layout.
   *
   * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   return c.render('Hello!')
   * })
   * ```
   */
  render = /* @__PURE__ */ __name((...args) => {
    this.#renderer ??= (content) => this.html(content);
    return this.#renderer(...args);
  }, "render");
  /**
   * Sets the layout for the response.
   *
   * @param layout - The layout to set.
   * @returns The layout function.
   */
  setLayout = /* @__PURE__ */ __name((layout) => this.#layout = layout, "setLayout");
  /**
   * Gets the current layout for the response.
   *
   * @returns The current layout function.
   */
  getLayout = /* @__PURE__ */ __name(() => this.#layout, "getLayout");
  /**
   * `.setRenderer()` can set the layout in the custom middleware.
   *
   * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
   *
   * @example
   * ```tsx
   * app.use('*', async (c, next) => {
   *   c.setRenderer((content) => {
   *     return c.html(
   *       <html>
   *         <body>
   *           <p>{content}</p>
   *         </body>
   *       </html>
   *     )
   *   })
   *   await next()
   * })
   * ```
   */
  setRenderer = /* @__PURE__ */ __name((renderer) => {
    this.#renderer = renderer;
  }, "setRenderer");
  /**
   * `.header()` can set headers.
   *
   * @see {@link https://hono.dev/docs/api/context#header}
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  header = /* @__PURE__ */ __name((name, value, options) => {
    if (this.finalized) {
      this.#res = createResponseInstance(this.#res.body, this.#res);
    }
    const headers = this.#res ? this.#res.headers : this.#preparedHeaders ??= new Headers();
    if (value === void 0) {
      headers.delete(name);
    } else if (options?.append) {
      headers.append(name, value);
    } else {
      headers.set(name, value);
    }
  }, "header");
  status = /* @__PURE__ */ __name((status) => {
    this.#status = status;
  }, "status");
  /**
   * `.set()` can set the value specified by the key.
   *
   * @see {@link https://hono.dev/docs/api/context#set-get}
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   c.set('message', 'Hono is hot!!')
   *   await next()
   * })
   * ```
   */
  set = /* @__PURE__ */ __name((key, value) => {
    this.#var ??= /* @__PURE__ */ new Map();
    this.#var.set(key, value);
  }, "set");
  /**
   * `.get()` can use the value specified by the key.
   *
   * @see {@link https://hono.dev/docs/api/context#set-get}
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   const message = c.get('message')
   *   return c.text(`The message is "${message}"`)
   * })
   * ```
   */
  get = /* @__PURE__ */ __name((key) => {
    return this.#var ? this.#var.get(key) : void 0;
  }, "get");
  /**
   * `.var` can access the value of a variable.
   *
   * @see {@link https://hono.dev/docs/api/context#var}
   *
   * @example
   * ```ts
   * const result = c.var.client.oneMethod()
   * ```
   */
  // c.var.propName is a read-only
  get var() {
    if (!this.#var) {
      return {};
    }
    return Object.fromEntries(this.#var);
  }
  #newResponse(data, arg, headers) {
    const responseHeaders = this.#res ? new Headers(this.#res.headers) : this.#preparedHeaders ?? new Headers();
    if (typeof arg === "object" && "headers" in arg) {
      const argHeaders = arg.headers instanceof Headers ? arg.headers : new Headers(arg.headers);
      for (const [key, value] of argHeaders) {
        if (key.toLowerCase() === "set-cookie") {
          responseHeaders.append(key, value);
        } else {
          responseHeaders.set(key, value);
        }
      }
    }
    if (headers) {
      for (const [k, v] of Object.entries(headers)) {
        if (typeof v === "string") {
          responseHeaders.set(k, v);
        } else {
          responseHeaders.delete(k);
          for (const v2 of v) {
            responseHeaders.append(k, v2);
          }
        }
      }
    }
    const status = typeof arg === "number" ? arg : arg?.status ?? this.#status;
    return createResponseInstance(data, { status, headers: responseHeaders });
  }
  newResponse = /* @__PURE__ */ __name((...args) => this.#newResponse(...args), "newResponse");
  /**
   * `.body()` can return the HTTP response.
   * You can set headers with `.header()` and set HTTP status code with `.status`.
   * This can also be set in `.text()`, `.json()` and so on.
   *
   * @see {@link https://hono.dev/docs/api/context#body}
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *   // Set HTTP status code
   *   c.status(201)
   *
   *   // Return the response body
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  body = /* @__PURE__ */ __name((data, arg, headers) => this.#newResponse(data, arg, headers), "body");
  /**
   * `.text()` can render text as `Content-Type:text/plain`.
   *
   * @see {@link https://hono.dev/docs/api/context#text}
   *
   * @example
   * ```ts
   * app.get('/say', (c) => {
   *   return c.text('Hello!')
   * })
   * ```
   */
  text = /* @__PURE__ */ __name((text, arg, headers) => {
    return !this.#preparedHeaders && !this.#status && !arg && !headers && !this.finalized ? new Response(text) : this.#newResponse(
      text,
      arg,
      setDefaultContentType(TEXT_PLAIN, headers)
    );
  }, "text");
  /**
   * `.json()` can render JSON as `Content-Type:application/json`.
   *
   * @see {@link https://hono.dev/docs/api/context#json}
   *
   * @example
   * ```ts
   * app.get('/api', (c) => {
   *   return c.json({ message: 'Hello!' })
   * })
   * ```
   */
  json = /* @__PURE__ */ __name((object, arg, headers) => {
    return this.#newResponse(
      JSON.stringify(object),
      arg,
      setDefaultContentType("application/json", headers)
    );
  }, "json");
  html = /* @__PURE__ */ __name((html, arg, headers) => {
    const res = /* @__PURE__ */ __name((html2) => this.#newResponse(html2, arg, setDefaultContentType("text/html; charset=UTF-8", headers)), "res");
    return typeof html === "object" ? resolveCallback(html, HtmlEscapedCallbackPhase.Stringify, false, {}).then(res) : res(html);
  }, "html");
  /**
   * `.redirect()` can Redirect, default status code is 302.
   *
   * @see {@link https://hono.dev/docs/api/context#redirect}
   *
   * @example
   * ```ts
   * app.get('/redirect', (c) => {
   *   return c.redirect('/')
   * })
   * app.get('/redirect-permanently', (c) => {
   *   return c.redirect('/', 301)
   * })
   * ```
   */
  redirect = /* @__PURE__ */ __name((location, status) => {
    const locationString = String(location);
    this.header(
      "Location",
      // Multibyes should be encoded
      // eslint-disable-next-line no-control-regex
      !/[^\x00-\xFF]/.test(locationString) ? locationString : encodeURI(locationString)
    );
    return this.newResponse(null, status ?? 302);
  }, "redirect");
  /**
   * `.notFound()` can return the Not Found Response.
   *
   * @see {@link https://hono.dev/docs/api/context#notfound}
   *
   * @example
   * ```ts
   * app.get('/notfound', (c) => {
   *   return c.notFound()
   * })
   * ```
   */
  notFound = /* @__PURE__ */ __name(() => {
    this.#notFoundHandler ??= () => createResponseInstance();
    return this.#notFoundHandler(this);
  }, "notFound");
};

// node_modules/hono/dist/router.js
var METHOD_NAME_ALL = "ALL";
var METHOD_NAME_ALL_LOWERCASE = "all";
var METHODS = ["get", "post", "put", "delete", "options", "patch"];
var MESSAGE_MATCHER_IS_ALREADY_BUILT = "Can not add a route since the matcher is already built.";
var UnsupportedPathError = class extends Error {
  static {
    __name(this, "UnsupportedPathError");
  }
};

// node_modules/hono/dist/utils/constants.js
var COMPOSED_HANDLER = "__COMPOSED_HANDLER";

// node_modules/hono/dist/hono-base.js
var notFoundHandler = /* @__PURE__ */ __name((c) => {
  return c.text("404 Not Found", 404);
}, "notFoundHandler");
var errorHandler = /* @__PURE__ */ __name((err, c) => {
  if ("getResponse" in err) {
    const res = err.getResponse();
    return c.newResponse(res.body, res);
  }
  console.error(err);
  return c.text("Internal Server Error", 500);
}, "errorHandler");
var Hono = class _Hono {
  static {
    __name(this, "_Hono");
  }
  get;
  post;
  put;
  delete;
  options;
  patch;
  all;
  on;
  use;
  /*
    This class is like an abstract class and does not have a router.
    To use it, inherit the class and implement router in the constructor.
  */
  router;
  getPath;
  // Cannot use `#` because it requires visibility at JavaScript runtime.
  _basePath = "/";
  #path = "/";
  routes = [];
  constructor(options = {}) {
    const allMethods = [...METHODS, METHOD_NAME_ALL_LOWERCASE];
    allMethods.forEach((method) => {
      this[method] = (args1, ...args) => {
        if (typeof args1 === "string") {
          this.#path = args1;
        } else {
          this.#addRoute(method, this.#path, args1);
        }
        args.forEach((handler) => {
          this.#addRoute(method, this.#path, handler);
        });
        return this;
      };
    });
    this.on = (method, path, ...handlers) => {
      for (const p of [path].flat()) {
        this.#path = p;
        for (const m of [method].flat()) {
          handlers.map((handler) => {
            this.#addRoute(m.toUpperCase(), this.#path, handler);
          });
        }
      }
      return this;
    };
    this.use = (arg1, ...handlers) => {
      if (typeof arg1 === "string") {
        this.#path = arg1;
      } else {
        this.#path = "*";
        handlers.unshift(arg1);
      }
      handlers.forEach((handler) => {
        this.#addRoute(METHOD_NAME_ALL, this.#path, handler);
      });
      return this;
    };
    const { strict, ...optionsWithoutStrict } = options;
    Object.assign(this, optionsWithoutStrict);
    this.getPath = strict ?? true ? options.getPath ?? getPath : getPathNoStrict;
  }
  #clone() {
    const clone = new _Hono({
      router: this.router,
      getPath: this.getPath
    });
    clone.errorHandler = this.errorHandler;
    clone.#notFoundHandler = this.#notFoundHandler;
    clone.routes = this.routes;
    return clone;
  }
  #notFoundHandler = notFoundHandler;
  // Cannot use `#` because it requires visibility at JavaScript runtime.
  errorHandler = errorHandler;
  /**
   * `.route()` allows grouping other Hono instance in routes.
   *
   * @see {@link https://hono.dev/docs/api/routing#grouping}
   *
   * @param {string} path - base Path
   * @param {Hono} app - other Hono instance
   * @returns {Hono} routed Hono instance
   *
   * @example
   * ```ts
   * const app = new Hono()
   * const app2 = new Hono()
   *
   * app2.get("/user", (c) => c.text("user"))
   * app.route("/api", app2) // GET /api/user
   * ```
   */
  route(path, app2) {
    const subApp = this.basePath(path);
    app2.routes.map((r) => {
      let handler;
      if (app2.errorHandler === errorHandler) {
        handler = r.handler;
      } else {
        handler = /* @__PURE__ */ __name(async (c, next) => (await compose([], app2.errorHandler)(c, () => r.handler(c, next))).res, "handler");
        handler[COMPOSED_HANDLER] = r.handler;
      }
      subApp.#addRoute(r.method, r.path, handler);
    });
    return this;
  }
  /**
   * `.basePath()` allows base paths to be specified.
   *
   * @see {@link https://hono.dev/docs/api/routing#base-path}
   *
   * @param {string} path - base Path
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * const api = new Hono().basePath('/api')
   * ```
   */
  basePath(path) {
    const subApp = this.#clone();
    subApp._basePath = mergePath(this._basePath, path);
    return subApp;
  }
  /**
   * `.onError()` handles an error and returns a customized Response.
   *
   * @see {@link https://hono.dev/docs/api/hono#error-handling}
   *
   * @param {ErrorHandler} handler - request Handler for error
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * app.onError((err, c) => {
   *   console.error(`${err}`)
   *   return c.text('Custom Error Message', 500)
   * })
   * ```
   */
  onError = /* @__PURE__ */ __name((handler) => {
    this.errorHandler = handler;
    return this;
  }, "onError");
  /**
   * `.notFound()` allows you to customize a Not Found Response.
   *
   * @see {@link https://hono.dev/docs/api/hono#not-found}
   *
   * @param {NotFoundHandler} handler - request handler for not-found
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * app.notFound((c) => {
   *   return c.text('Custom 404 Message', 404)
   * })
   * ```
   */
  notFound = /* @__PURE__ */ __name((handler) => {
    this.#notFoundHandler = handler;
    return this;
  }, "notFound");
  /**
   * `.mount()` allows you to mount applications built with other frameworks into your Hono application.
   *
   * @see {@link https://hono.dev/docs/api/hono#mount}
   *
   * @param {string} path - base Path
   * @param {Function} applicationHandler - other Request Handler
   * @param {MountOptions} [options] - options of `.mount()`
   * @returns {Hono} mounted Hono instance
   *
   * @example
   * ```ts
   * import { Router as IttyRouter } from 'itty-router'
   * import { Hono } from 'hono'
   * // Create itty-router application
   * const ittyRouter = IttyRouter()
   * // GET /itty-router/hello
   * ittyRouter.get('/hello', () => new Response('Hello from itty-router'))
   *
   * const app = new Hono()
   * app.mount('/itty-router', ittyRouter.handle)
   * ```
   *
   * @example
   * ```ts
   * const app = new Hono()
   * // Send the request to another application without modification.
   * app.mount('/app', anotherApp, {
   *   replaceRequest: (req) => req,
   * })
   * ```
   */
  mount(path, applicationHandler, options) {
    let replaceRequest;
    let optionHandler;
    if (options) {
      if (typeof options === "function") {
        optionHandler = options;
      } else {
        optionHandler = options.optionHandler;
        if (options.replaceRequest === false) {
          replaceRequest = /* @__PURE__ */ __name((request) => request, "replaceRequest");
        } else {
          replaceRequest = options.replaceRequest;
        }
      }
    }
    const getOptions = optionHandler ? (c) => {
      const options2 = optionHandler(c);
      return Array.isArray(options2) ? options2 : [options2];
    } : (c) => {
      let executionContext = void 0;
      try {
        executionContext = c.executionCtx;
      } catch {
      }
      return [c.env, executionContext];
    };
    replaceRequest ||= (() => {
      const mergedPath = mergePath(this._basePath, path);
      const pathPrefixLength = mergedPath === "/" ? 0 : mergedPath.length;
      return (request) => {
        const url = new URL(request.url);
        url.pathname = url.pathname.slice(pathPrefixLength) || "/";
        return new Request(url, request);
      };
    })();
    const handler = /* @__PURE__ */ __name(async (c, next) => {
      const res = await applicationHandler(replaceRequest(c.req.raw), ...getOptions(c));
      if (res) {
        return res;
      }
      await next();
    }, "handler");
    this.#addRoute(METHOD_NAME_ALL, mergePath(path, "*"), handler);
    return this;
  }
  #addRoute(method, path, handler) {
    method = method.toUpperCase();
    path = mergePath(this._basePath, path);
    const r = { basePath: this._basePath, path, method, handler };
    this.router.add(method, path, [handler, r]);
    this.routes.push(r);
  }
  #handleError(err, c) {
    if (err instanceof Error) {
      return this.errorHandler(err, c);
    }
    throw err;
  }
  #dispatch(request, executionCtx, env, method) {
    if (method === "HEAD") {
      return (async () => new Response(null, await this.#dispatch(request, executionCtx, env, "GET")))();
    }
    const path = this.getPath(request, { env });
    const matchResult = this.router.match(method, path);
    const c = new Context(request, {
      path,
      matchResult,
      env,
      executionCtx,
      notFoundHandler: this.#notFoundHandler
    });
    if (matchResult[0].length === 1) {
      let res;
      try {
        res = matchResult[0][0][0][0](c, async () => {
          c.res = await this.#notFoundHandler(c);
        });
      } catch (err) {
        return this.#handleError(err, c);
      }
      return res instanceof Promise ? res.then(
        (resolved) => resolved || (c.finalized ? c.res : this.#notFoundHandler(c))
      ).catch((err) => this.#handleError(err, c)) : res ?? this.#notFoundHandler(c);
    }
    const composed = compose(matchResult[0], this.errorHandler, this.#notFoundHandler);
    return (async () => {
      try {
        const context = await composed(c);
        if (!context.finalized) {
          throw new Error(
            "Context is not finalized. Did you forget to return a Response object or `await next()`?"
          );
        }
        return context.res;
      } catch (err) {
        return this.#handleError(err, c);
      }
    })();
  }
  /**
   * `.fetch()` will be entry point of your app.
   *
   * @see {@link https://hono.dev/docs/api/hono#fetch}
   *
   * @param {Request} request - request Object of request
   * @param {Env} Env - env Object
   * @param {ExecutionContext} - context of execution
   * @returns {Response | Promise<Response>} response of request
   *
   */
  fetch = /* @__PURE__ */ __name((request, ...rest) => {
    return this.#dispatch(request, rest[1], rest[0], request.method);
  }, "fetch");
  /**
   * `.request()` is a useful method for testing.
   * You can pass a URL or pathname to send a GET request.
   * app will return a Response object.
   * ```ts
   * test('GET /hello is ok', async () => {
   *   const res = await app.request('/hello')
   *   expect(res.status).toBe(200)
   * })
   * ```
   * @see https://hono.dev/docs/api/hono#request
   */
  request = /* @__PURE__ */ __name((input, requestInit, Env, executionCtx) => {
    if (input instanceof Request) {
      return this.fetch(requestInit ? new Request(input, requestInit) : input, Env, executionCtx);
    }
    input = input.toString();
    return this.fetch(
      new Request(
        /^https?:\/\//.test(input) ? input : `http://localhost${mergePath("/", input)}`,
        requestInit
      ),
      Env,
      executionCtx
    );
  }, "request");
  /**
   * `.fire()` automatically adds a global fetch event listener.
   * This can be useful for environments that adhere to the Service Worker API, such as non-ES module Cloudflare Workers.
   * @deprecated
   * Use `fire` from `hono/service-worker` instead.
   * ```ts
   * import { Hono } from 'hono'
   * import { fire } from 'hono/service-worker'
   *
   * const app = new Hono()
   * // ...
   * fire(app)
   * ```
   * @see https://hono.dev/docs/api/hono#fire
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
   * @see https://developers.cloudflare.com/workers/reference/migrate-to-module-workers/
   */
  fire = /* @__PURE__ */ __name(() => {
    addEventListener("fetch", (event) => {
      event.respondWith(this.#dispatch(event.request, event, void 0, event.request.method));
    });
  }, "fire");
};

// node_modules/hono/dist/router/reg-exp-router/matcher.js
var emptyParam = [];
function match(method, path) {
  const matchers = this.buildAllMatchers();
  const match2 = /* @__PURE__ */ __name(((method2, path2) => {
    const matcher = matchers[method2] || matchers[METHOD_NAME_ALL];
    const staticMatch = matcher[2][path2];
    if (staticMatch) {
      return staticMatch;
    }
    const match3 = path2.match(matcher[0]);
    if (!match3) {
      return [[], emptyParam];
    }
    const index = match3.indexOf("", 1);
    return [matcher[1][index], match3];
  }), "match2");
  this.match = match2;
  return match2(method, path);
}
__name(match, "match");

// node_modules/hono/dist/router/reg-exp-router/node.js
var LABEL_REG_EXP_STR = "[^/]+";
var ONLY_WILDCARD_REG_EXP_STR = ".*";
var TAIL_WILDCARD_REG_EXP_STR = "(?:|/.*)";
var PATH_ERROR = /* @__PURE__ */ Symbol();
var regExpMetaChars = new Set(".\\+*[^]$()");
function compareKey(a, b) {
  if (a.length === 1) {
    return b.length === 1 ? a < b ? -1 : 1 : -1;
  }
  if (b.length === 1) {
    return 1;
  }
  if (a === ONLY_WILDCARD_REG_EXP_STR || a === TAIL_WILDCARD_REG_EXP_STR) {
    return 1;
  } else if (b === ONLY_WILDCARD_REG_EXP_STR || b === TAIL_WILDCARD_REG_EXP_STR) {
    return -1;
  }
  if (a === LABEL_REG_EXP_STR) {
    return 1;
  } else if (b === LABEL_REG_EXP_STR) {
    return -1;
  }
  return a.length === b.length ? a < b ? -1 : 1 : b.length - a.length;
}
__name(compareKey, "compareKey");
var Node = class _Node {
  static {
    __name(this, "_Node");
  }
  #index;
  #varIndex;
  #children = /* @__PURE__ */ Object.create(null);
  insert(tokens, index, paramMap, context, pathErrorCheckOnly) {
    if (tokens.length === 0) {
      if (this.#index !== void 0) {
        throw PATH_ERROR;
      }
      if (pathErrorCheckOnly) {
        return;
      }
      this.#index = index;
      return;
    }
    const [token, ...restTokens] = tokens;
    const pattern = token === "*" ? restTokens.length === 0 ? ["", "", ONLY_WILDCARD_REG_EXP_STR] : ["", "", LABEL_REG_EXP_STR] : token === "/*" ? ["", "", TAIL_WILDCARD_REG_EXP_STR] : token.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
    let node;
    if (pattern) {
      const name = pattern[1];
      let regexpStr = pattern[2] || LABEL_REG_EXP_STR;
      if (name && pattern[2]) {
        if (regexpStr === ".*") {
          throw PATH_ERROR;
        }
        regexpStr = regexpStr.replace(/^\((?!\?:)(?=[^)]+\)$)/, "(?:");
        if (/\((?!\?:)/.test(regexpStr)) {
          throw PATH_ERROR;
        }
      }
      node = this.#children[regexpStr];
      if (!node) {
        if (Object.keys(this.#children).some(
          (k) => k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR
        )) {
          throw PATH_ERROR;
        }
        if (pathErrorCheckOnly) {
          return;
        }
        node = this.#children[regexpStr] = new _Node();
        if (name !== "") {
          node.#varIndex = context.varIndex++;
        }
      }
      if (!pathErrorCheckOnly && name !== "") {
        paramMap.push([name, node.#varIndex]);
      }
    } else {
      node = this.#children[token];
      if (!node) {
        if (Object.keys(this.#children).some(
          (k) => k.length > 1 && k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR
        )) {
          throw PATH_ERROR;
        }
        if (pathErrorCheckOnly) {
          return;
        }
        node = this.#children[token] = new _Node();
      }
    }
    node.insert(restTokens, index, paramMap, context, pathErrorCheckOnly);
  }
  buildRegExpStr() {
    const childKeys = Object.keys(this.#children).sort(compareKey);
    const strList = childKeys.map((k) => {
      const c = this.#children[k];
      return (typeof c.#varIndex === "number" ? `(${k})@${c.#varIndex}` : regExpMetaChars.has(k) ? `\\${k}` : k) + c.buildRegExpStr();
    });
    if (typeof this.#index === "number") {
      strList.unshift(`#${this.#index}`);
    }
    if (strList.length === 0) {
      return "";
    }
    if (strList.length === 1) {
      return strList[0];
    }
    return "(?:" + strList.join("|") + ")";
  }
};

// node_modules/hono/dist/router/reg-exp-router/trie.js
var Trie = class {
  static {
    __name(this, "Trie");
  }
  #context = { varIndex: 0 };
  #root = new Node();
  insert(path, index, pathErrorCheckOnly) {
    const paramAssoc = [];
    const groups = [];
    for (let i = 0; ; ) {
      let replaced = false;
      path = path.replace(/\{[^}]+\}/g, (m) => {
        const mark = `@\\${i}`;
        groups[i] = [mark, m];
        i++;
        replaced = true;
        return mark;
      });
      if (!replaced) {
        break;
      }
    }
    const tokens = path.match(/(?::[^\/]+)|(?:\/\*$)|./g) || [];
    for (let i = groups.length - 1; i >= 0; i--) {
      const [mark] = groups[i];
      for (let j = tokens.length - 1; j >= 0; j--) {
        if (tokens[j].indexOf(mark) !== -1) {
          tokens[j] = tokens[j].replace(mark, groups[i][1]);
          break;
        }
      }
    }
    this.#root.insert(tokens, index, paramAssoc, this.#context, pathErrorCheckOnly);
    return paramAssoc;
  }
  buildRegExp() {
    let regexp = this.#root.buildRegExpStr();
    if (regexp === "") {
      return [/^$/, [], []];
    }
    let captureIndex = 0;
    const indexReplacementMap = [];
    const paramReplacementMap = [];
    regexp = regexp.replace(/#(\d+)|@(\d+)|\.\*\$/g, (_, handlerIndex, paramIndex) => {
      if (handlerIndex !== void 0) {
        indexReplacementMap[++captureIndex] = Number(handlerIndex);
        return "$()";
      }
      if (paramIndex !== void 0) {
        paramReplacementMap[Number(paramIndex)] = ++captureIndex;
        return "";
      }
      return "";
    });
    return [new RegExp(`^${regexp}`), indexReplacementMap, paramReplacementMap];
  }
};

// node_modules/hono/dist/router/reg-exp-router/router.js
var nullMatcher = [/^$/, [], /* @__PURE__ */ Object.create(null)];
var wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
function buildWildcardRegExp(path) {
  return wildcardRegExpCache[path] ??= new RegExp(
    path === "*" ? "" : `^${path.replace(
      /\/\*$|([.\\+*[^\]$()])/g,
      (_, metaChar) => metaChar ? `\\${metaChar}` : "(?:|/.*)"
    )}$`
  );
}
__name(buildWildcardRegExp, "buildWildcardRegExp");
function clearWildcardRegExpCache() {
  wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
}
__name(clearWildcardRegExpCache, "clearWildcardRegExpCache");
function buildMatcherFromPreprocessedRoutes(routes) {
  const trie = new Trie();
  const handlerData = [];
  if (routes.length === 0) {
    return nullMatcher;
  }
  const routesWithStaticPathFlag = routes.map(
    (route) => [!/\*|\/:/.test(route[0]), ...route]
  ).sort(
    ([isStaticA, pathA], [isStaticB, pathB]) => isStaticA ? 1 : isStaticB ? -1 : pathA.length - pathB.length
  );
  const staticMap = /* @__PURE__ */ Object.create(null);
  for (let i = 0, j = -1, len = routesWithStaticPathFlag.length; i < len; i++) {
    const [pathErrorCheckOnly, path, handlers] = routesWithStaticPathFlag[i];
    if (pathErrorCheckOnly) {
      staticMap[path] = [handlers.map(([h]) => [h, /* @__PURE__ */ Object.create(null)]), emptyParam];
    } else {
      j++;
    }
    let paramAssoc;
    try {
      paramAssoc = trie.insert(path, j, pathErrorCheckOnly);
    } catch (e) {
      throw e === PATH_ERROR ? new UnsupportedPathError(path) : e;
    }
    if (pathErrorCheckOnly) {
      continue;
    }
    handlerData[j] = handlers.map(([h, paramCount]) => {
      const paramIndexMap = /* @__PURE__ */ Object.create(null);
      paramCount -= 1;
      for (; paramCount >= 0; paramCount--) {
        const [key, value] = paramAssoc[paramCount];
        paramIndexMap[key] = value;
      }
      return [h, paramIndexMap];
    });
  }
  const [regexp, indexReplacementMap, paramReplacementMap] = trie.buildRegExp();
  for (let i = 0, len = handlerData.length; i < len; i++) {
    for (let j = 0, len2 = handlerData[i].length; j < len2; j++) {
      const map = handlerData[i][j]?.[1];
      if (!map) {
        continue;
      }
      const keys = Object.keys(map);
      for (let k = 0, len3 = keys.length; k < len3; k++) {
        map[keys[k]] = paramReplacementMap[map[keys[k]]];
      }
    }
  }
  const handlerMap = [];
  for (const i in indexReplacementMap) {
    handlerMap[i] = handlerData[indexReplacementMap[i]];
  }
  return [regexp, handlerMap, staticMap];
}
__name(buildMatcherFromPreprocessedRoutes, "buildMatcherFromPreprocessedRoutes");
function findMiddleware(middleware, path) {
  if (!middleware) {
    return void 0;
  }
  for (const k of Object.keys(middleware).sort((a, b) => b.length - a.length)) {
    if (buildWildcardRegExp(k).test(path)) {
      return [...middleware[k]];
    }
  }
  return void 0;
}
__name(findMiddleware, "findMiddleware");
var RegExpRouter = class {
  static {
    __name(this, "RegExpRouter");
  }
  name = "RegExpRouter";
  #middleware;
  #routes;
  constructor() {
    this.#middleware = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
    this.#routes = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
  }
  add(method, path, handler) {
    const middleware = this.#middleware;
    const routes = this.#routes;
    if (!middleware || !routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    if (!middleware[method]) {
      ;
      [middleware, routes].forEach((handlerMap) => {
        handlerMap[method] = /* @__PURE__ */ Object.create(null);
        Object.keys(handlerMap[METHOD_NAME_ALL]).forEach((p) => {
          handlerMap[method][p] = [...handlerMap[METHOD_NAME_ALL][p]];
        });
      });
    }
    if (path === "/*") {
      path = "*";
    }
    const paramCount = (path.match(/\/:/g) || []).length;
    if (/\*$/.test(path)) {
      const re = buildWildcardRegExp(path);
      if (method === METHOD_NAME_ALL) {
        Object.keys(middleware).forEach((m) => {
          middleware[m][path] ||= findMiddleware(middleware[m], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || [];
        });
      } else {
        middleware[method][path] ||= findMiddleware(middleware[method], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || [];
      }
      Object.keys(middleware).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(middleware[m]).forEach((p) => {
            re.test(p) && middleware[m][p].push([handler, paramCount]);
          });
        }
      });
      Object.keys(routes).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(routes[m]).forEach(
            (p) => re.test(p) && routes[m][p].push([handler, paramCount])
          );
        }
      });
      return;
    }
    const paths = checkOptionalParameter(path) || [path];
    for (let i = 0, len = paths.length; i < len; i++) {
      const path2 = paths[i];
      Object.keys(routes).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          routes[m][path2] ||= [
            ...findMiddleware(middleware[m], path2) || findMiddleware(middleware[METHOD_NAME_ALL], path2) || []
          ];
          routes[m][path2].push([handler, paramCount - len + i + 1]);
        }
      });
    }
  }
  match = match;
  buildAllMatchers() {
    const matchers = /* @__PURE__ */ Object.create(null);
    Object.keys(this.#routes).concat(Object.keys(this.#middleware)).forEach((method) => {
      matchers[method] ||= this.#buildMatcher(method);
    });
    this.#middleware = this.#routes = void 0;
    clearWildcardRegExpCache();
    return matchers;
  }
  #buildMatcher(method) {
    const routes = [];
    let hasOwnRoute = method === METHOD_NAME_ALL;
    [this.#middleware, this.#routes].forEach((r) => {
      const ownRoute = r[method] ? Object.keys(r[method]).map((path) => [path, r[method][path]]) : [];
      if (ownRoute.length !== 0) {
        hasOwnRoute ||= true;
        routes.push(...ownRoute);
      } else if (method !== METHOD_NAME_ALL) {
        routes.push(
          ...Object.keys(r[METHOD_NAME_ALL]).map((path) => [path, r[METHOD_NAME_ALL][path]])
        );
      }
    });
    if (!hasOwnRoute) {
      return null;
    } else {
      return buildMatcherFromPreprocessedRoutes(routes);
    }
  }
};

// node_modules/hono/dist/router/smart-router/router.js
var SmartRouter = class {
  static {
    __name(this, "SmartRouter");
  }
  name = "SmartRouter";
  #routers = [];
  #routes = [];
  constructor(init) {
    this.#routers = init.routers;
  }
  add(method, path, handler) {
    if (!this.#routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    this.#routes.push([method, path, handler]);
  }
  match(method, path) {
    if (!this.#routes) {
      throw new Error("Fatal error");
    }
    const routers = this.#routers;
    const routes = this.#routes;
    const len = routers.length;
    let i = 0;
    let res;
    for (; i < len; i++) {
      const router = routers[i];
      try {
        for (let i2 = 0, len2 = routes.length; i2 < len2; i2++) {
          router.add(...routes[i2]);
        }
        res = router.match(method, path);
      } catch (e) {
        if (e instanceof UnsupportedPathError) {
          continue;
        }
        throw e;
      }
      this.match = router.match.bind(router);
      this.#routers = [router];
      this.#routes = void 0;
      break;
    }
    if (i === len) {
      throw new Error("Fatal error");
    }
    this.name = `SmartRouter + ${this.activeRouter.name}`;
    return res;
  }
  get activeRouter() {
    if (this.#routes || this.#routers.length !== 1) {
      throw new Error("No active router has been determined yet.");
    }
    return this.#routers[0];
  }
};

// node_modules/hono/dist/router/trie-router/node.js
var emptyParams = /* @__PURE__ */ Object.create(null);
var hasChildren = /* @__PURE__ */ __name((children) => {
  for (const _ in children) {
    return true;
  }
  return false;
}, "hasChildren");
var Node2 = class _Node2 {
  static {
    __name(this, "_Node");
  }
  #methods;
  #children;
  #patterns;
  #order = 0;
  #params = emptyParams;
  constructor(method, handler, children) {
    this.#children = children || /* @__PURE__ */ Object.create(null);
    this.#methods = [];
    if (method && handler) {
      const m = /* @__PURE__ */ Object.create(null);
      m[method] = { handler, possibleKeys: [], score: 0 };
      this.#methods = [m];
    }
    this.#patterns = [];
  }
  insert(method, path, handler) {
    this.#order = ++this.#order;
    let curNode = this;
    const parts = splitRoutingPath(path);
    const possibleKeys = [];
    for (let i = 0, len = parts.length; i < len; i++) {
      const p = parts[i];
      const nextP = parts[i + 1];
      const pattern = getPattern(p, nextP);
      const key = Array.isArray(pattern) ? pattern[0] : p;
      if (key in curNode.#children) {
        curNode = curNode.#children[key];
        if (pattern) {
          possibleKeys.push(pattern[1]);
        }
        continue;
      }
      curNode.#children[key] = new _Node2();
      if (pattern) {
        curNode.#patterns.push(pattern);
        possibleKeys.push(pattern[1]);
      }
      curNode = curNode.#children[key];
    }
    curNode.#methods.push({
      [method]: {
        handler,
        possibleKeys: possibleKeys.filter((v, i, a) => a.indexOf(v) === i),
        score: this.#order
      }
    });
    return curNode;
  }
  #pushHandlerSets(handlerSets, node, method, nodeParams, params) {
    for (let i = 0, len = node.#methods.length; i < len; i++) {
      const m = node.#methods[i];
      const handlerSet = m[method] || m[METHOD_NAME_ALL];
      const processedSet = {};
      if (handlerSet !== void 0) {
        handlerSet.params = /* @__PURE__ */ Object.create(null);
        handlerSets.push(handlerSet);
        if (nodeParams !== emptyParams || params && params !== emptyParams) {
          for (let i2 = 0, len2 = handlerSet.possibleKeys.length; i2 < len2; i2++) {
            const key = handlerSet.possibleKeys[i2];
            const processed = processedSet[handlerSet.score];
            handlerSet.params[key] = params?.[key] && !processed ? params[key] : nodeParams[key] ?? params?.[key];
            processedSet[handlerSet.score] = true;
          }
        }
      }
    }
  }
  search(method, path) {
    const handlerSets = [];
    this.#params = emptyParams;
    const curNode = this;
    let curNodes = [curNode];
    const parts = splitPath(path);
    const curNodesQueue = [];
    const len = parts.length;
    let partOffsets = null;
    for (let i = 0; i < len; i++) {
      const part = parts[i];
      const isLast = i === len - 1;
      const tempNodes = [];
      for (let j = 0, len2 = curNodes.length; j < len2; j++) {
        const node = curNodes[j];
        const nextNode = node.#children[part];
        if (nextNode) {
          nextNode.#params = node.#params;
          if (isLast) {
            if (nextNode.#children["*"]) {
              this.#pushHandlerSets(handlerSets, nextNode.#children["*"], method, node.#params);
            }
            this.#pushHandlerSets(handlerSets, nextNode, method, node.#params);
          } else {
            tempNodes.push(nextNode);
          }
        }
        for (let k = 0, len3 = node.#patterns.length; k < len3; k++) {
          const pattern = node.#patterns[k];
          const params = node.#params === emptyParams ? {} : { ...node.#params };
          if (pattern === "*") {
            const astNode = node.#children["*"];
            if (astNode) {
              this.#pushHandlerSets(handlerSets, astNode, method, node.#params);
              astNode.#params = params;
              tempNodes.push(astNode);
            }
            continue;
          }
          const [key, name, matcher] = pattern;
          if (!part && !(matcher instanceof RegExp)) {
            continue;
          }
          const child = node.#children[key];
          if (matcher instanceof RegExp) {
            if (partOffsets === null) {
              partOffsets = new Array(len);
              let offset = path[0] === "/" ? 1 : 0;
              for (let p = 0; p < len; p++) {
                partOffsets[p] = offset;
                offset += parts[p].length + 1;
              }
            }
            const restPathString = path.substring(partOffsets[i]);
            const m = matcher.exec(restPathString);
            if (m) {
              params[name] = m[0];
              this.#pushHandlerSets(handlerSets, child, method, node.#params, params);
              if (hasChildren(child.#children)) {
                child.#params = params;
                const componentCount = m[0].match(/\//)?.length ?? 0;
                const targetCurNodes = curNodesQueue[componentCount] ||= [];
                targetCurNodes.push(child);
              }
              continue;
            }
          }
          if (matcher === true || matcher.test(part)) {
            params[name] = part;
            if (isLast) {
              this.#pushHandlerSets(handlerSets, child, method, params, node.#params);
              if (child.#children["*"]) {
                this.#pushHandlerSets(
                  handlerSets,
                  child.#children["*"],
                  method,
                  params,
                  node.#params
                );
              }
            } else {
              child.#params = params;
              tempNodes.push(child);
            }
          }
        }
      }
      const shifted = curNodesQueue.shift();
      curNodes = shifted ? tempNodes.concat(shifted) : tempNodes;
    }
    if (handlerSets.length > 1) {
      handlerSets.sort((a, b) => {
        return a.score - b.score;
      });
    }
    return [handlerSets.map(({ handler, params }) => [handler, params])];
  }
};

// node_modules/hono/dist/router/trie-router/router.js
var TrieRouter = class {
  static {
    __name(this, "TrieRouter");
  }
  name = "TrieRouter";
  #node;
  constructor() {
    this.#node = new Node2();
  }
  add(method, path, handler) {
    const results = checkOptionalParameter(path);
    if (results) {
      for (let i = 0, len = results.length; i < len; i++) {
        this.#node.insert(method, results[i], handler);
      }
      return;
    }
    this.#node.insert(method, path, handler);
  }
  match(method, path) {
    return this.#node.search(method, path);
  }
};

// node_modules/hono/dist/hono.js
var Hono2 = class extends Hono {
  static {
    __name(this, "Hono");
  }
  /**
   * Creates an instance of the Hono class.
   *
   * @param options - Optional configuration options for the Hono instance.
   */
  constructor(options = {}) {
    super(options);
    this.router = options.router ?? new SmartRouter({
      routers: [new RegExpRouter(), new TrieRouter()]
    });
  }
};

// node_modules/hono/dist/middleware/cors/index.js
var cors = /* @__PURE__ */ __name((options) => {
  const defaults = {
    origin: "*",
    allowMethods: ["GET", "HEAD", "PUT", "POST", "DELETE", "PATCH"],
    allowHeaders: [],
    exposeHeaders: []
  };
  const opts = {
    ...defaults,
    ...options
  };
  const findAllowOrigin = ((optsOrigin) => {
    if (typeof optsOrigin === "string") {
      if (optsOrigin === "*") {
        if (opts.credentials) {
          return (origin) => origin || null;
        }
        return () => optsOrigin;
      } else {
        return (origin) => optsOrigin === origin ? origin : null;
      }
    } else if (typeof optsOrigin === "function") {
      return optsOrigin;
    } else {
      return (origin) => optsOrigin.includes(origin) ? origin : null;
    }
  })(opts.origin);
  const findAllowMethods = ((optsAllowMethods) => {
    if (typeof optsAllowMethods === "function") {
      return optsAllowMethods;
    } else if (Array.isArray(optsAllowMethods)) {
      return () => optsAllowMethods;
    } else {
      return () => [];
    }
  })(opts.allowMethods);
  return /* @__PURE__ */ __name(async function cors2(c, next) {
    function set(key, value) {
      c.res.headers.set(key, value);
    }
    __name(set, "set");
    const allowOrigin = await findAllowOrigin(c.req.header("origin") || "", c);
    if (allowOrigin) {
      set("Access-Control-Allow-Origin", allowOrigin);
    }
    if (opts.credentials) {
      set("Access-Control-Allow-Credentials", "true");
    }
    if (opts.exposeHeaders?.length) {
      set("Access-Control-Expose-Headers", opts.exposeHeaders.join(","));
    }
    if (c.req.method === "OPTIONS") {
      if (opts.origin !== "*" || opts.credentials) {
        set("Vary", "Origin");
      }
      if (opts.maxAge != null) {
        set("Access-Control-Max-Age", opts.maxAge.toString());
      }
      const allowMethods = await findAllowMethods(c.req.header("origin") || "", c);
      if (allowMethods.length) {
        set("Access-Control-Allow-Methods", allowMethods.join(","));
      }
      let headers = opts.allowHeaders;
      if (!headers?.length) {
        const requestHeaders = c.req.header("Access-Control-Request-Headers");
        if (requestHeaders) {
          headers = requestHeaders.split(/\s*,\s*/);
        }
      }
      if (headers?.length) {
        set("Access-Control-Allow-Headers", headers.join(","));
        c.res.headers.append("Vary", "Access-Control-Request-Headers");
      }
      c.res.headers.delete("Content-Length");
      c.res.headers.delete("Content-Type");
      return new Response(null, {
        headers: c.res.headers,
        status: 204,
        statusText: "No Content"
      });
    }
    await next();
    if (opts.origin !== "*" || opts.credentials) {
      c.header("Vary", "Origin", { append: true });
    }
  }, "cors2");
}, "cors");

// src/wine-schema.json
var wine_schema_default = {
  wine_types: ["red", "white", "rose", "sparkling", "dessert"],
  varietals: [
    "cabernet-sauvignon",
    "merlot",
    "pinot-noir",
    "syrah",
    "malbec",
    "zinfandel",
    "tempranillo",
    "sangiovese",
    "nebbiolo",
    "grenache",
    "chardonnay",
    "sauvignon-blanc",
    "riesling",
    "pinot-grigio",
    "gewurztraminer",
    "viognier",
    "chenin-blanc",
    "moscato",
    "champagne-blend",
    "prosecco-blend",
    "red-blend",
    "white-blend"
  ],
  regions: [
    "california",
    "central-coast",
    "napa-valley",
    "sonoma",
    "sonoma-county",
    "dry-creek-valley",
    "willamette-valley",
    "paso-robles",
    "russian-river-valley",
    "monterey-county",
    "arroyo-seco",
    "bordeaux",
    "burgundy",
    "champagne",
    "rhone-valley",
    "loire-valley",
    "alsace",
    "provence",
    "tuscany",
    "piedmont",
    "veneto",
    "cava",
    "rioja",
    "ribera-del-duero",
    "barossa-valley",
    "marlborough",
    "mendoza",
    "mosel",
    "new-mexico",
    "stellenbosch"
  ],
  body: ["light", "medium", "full"],
  sweetness: ["dry", "off-dry", "sweet"],
  acidity: ["low", "medium", "high"],
  tannin: ["low", "medium", "high"],
  flavor_families: {
    "berry-cherry": ["berry", "cherry", "plum", "blackberry"],
    "citrus-green-apple": ["citrus", "green-apple", "lemon", "grapefruit"],
    "tropical-stone-fruit": ["tropical", "peach", "mango", "pineapple"],
    "chocolate-coffee": ["chocolate", "coffee", "cocoa", "mocha"],
    "vanilla-caramel": ["vanilla", "caramel", "butterscotch", "toffee"],
    "pepper-spice": ["pepper", "spice", "clove", "cinnamon"],
    "floral-herbal": ["floral", "rose", "violet", "herbal", "mint"],
    "earthy-mineral": ["earthy", "mineral", "slate", "mushroom"]
  },
  occasions: [
    "dinner-party",
    "date-night",
    "gift",
    "casual",
    "celebration",
    "cooking",
    "brunch"
  ],
  food_pairings: [
    "steak",
    "lamb",
    "poultry",
    "pork",
    "salmon",
    "seafood",
    "shellfish",
    "pasta",
    "pizza",
    "risotto",
    "cheese",
    "charcuterie",
    "salad",
    "vegetables",
    "chocolate",
    "dessert",
    "fruit"
  ],
  style_tags: [
    "brut",
    "champagne",
    "prosecco",
    "cava",
    "cremant",
    "blanc-de-blancs",
    "sparkling-rose",
    "moscato"
  ]
};

// src/wine-schema.ts
var WINE_TYPES = wine_schema_default.wine_types;
var VARIETALS = wine_schema_default.varietals;
var REGIONS = wine_schema_default.regions;
var BODY_LEVELS = wine_schema_default.body;
var SWEETNESS_LEVELS = wine_schema_default.sweetness;
var ACIDITY_LEVELS = wine_schema_default.acidity;
var TANNIN_LEVELS = wine_schema_default.tannin;
var FLAVOR_FAMILIES = wine_schema_default.flavor_families;
var OCCASIONS = wine_schema_default.occasions;
var FOOD_PAIRINGS = wine_schema_default.food_pairings;
var STYLE_TAGS = wine_schema_default.style_tags;
var ALL_FLAVOR_TAGS = Object.values(FLAVOR_FAMILIES).flat();
function isValidWineType(type) {
  return WINE_TYPES.includes(type.toLowerCase());
}
__name(isValidWineType, "isValidWineType");
function isValidBody(body) {
  return BODY_LEVELS.includes(body.toLowerCase());
}
__name(isValidBody, "isValidBody");
function isValidSweetness(sweetness) {
  return SWEETNESS_LEVELS.includes(sweetness.toLowerCase());
}
__name(isValidSweetness, "isValidSweetness");
function isValidAcidity(acidity) {
  return ACIDITY_LEVELS.includes(acidity.toLowerCase());
}
__name(isValidAcidity, "isValidAcidity");
function isValidTannin(tannin) {
  return TANNIN_LEVELS.includes(tannin.toLowerCase());
}
__name(isValidTannin, "isValidTannin");
function isValidStyleTag(styleTag) {
  return STYLE_TAGS.includes(styleTag.toLowerCase());
}
__name(isValidStyleTag, "isValidStyleTag");
function normalizeStyleTag(input) {
  const lower = input.toLowerCase().trim();
  const aliases = {
    "brut": "brut",
    "champagne": "champagne",
    "prosecco": "prosecco",
    "cava": "cava",
    "cremant": "cremant",
    "cr\xE9mant": "cremant",
    "blanc de blancs": "blanc-de-blancs",
    "blanc-de-blancs": "blanc-de-blancs",
    "sparkling rose": "sparkling-rose",
    "sparkling ros\xE9": "sparkling-rose",
    "rose bubbles": "sparkling-rose",
    "ros\xE9 bubbles": "sparkling-rose",
    "pink bubbles": "sparkling-rose",
    "sparkling moscato": "moscato",
    "moscato": "moscato"
  };
  return aliases[lower] ?? (STYLE_TAGS.includes(lower) ? lower : null);
}
__name(normalizeStyleTag, "normalizeStyleTag");
function getWineSchemaForPrompt() {
  return `
WINE SCHEMA:
- Wine Types: ${WINE_TYPES.join(", ")}
- Body: ${BODY_LEVELS.join(", ")}
- Sweetness: ${SWEETNESS_LEVELS.join(", ")}
- Acidity: ${ACIDITY_LEVELS.join(", ")}
- Tannin: ${TANNIN_LEVELS.join(", ")}
- Flavor Families: ${Object.keys(FLAVOR_FAMILIES).join(", ")}
- Occasions: ${OCCASIONS.join(", ")}
- Common Food Pairings: ${FOOD_PAIRINGS.join(", ")}
- Regions: ${REGIONS.join(", ")}
- Common Varietals: ${VARIETALS.join(", ")}
- Style Tags: ${STYLE_TAGS.join(", ")}
`.trim();
}
__name(getWineSchemaForPrompt, "getWineSchemaForPrompt");

// src/profiles/brand-concierge.ts
var brandConciergeProfile = {
  profileType: "brand_concierge",
  storeName: "ONEHOPE Wine",
  storeDescription: "A Napa Valley winery crafting purpose-driven wines, tasting experiences, and gifts that give back.",
  brandName: "ONEHOPE Wine",
  allowCrossBrand: false,
  tone: "premium, consultative, warm",
  catalogScope: "Only wines from the ONEHOPE Wine portfolio",
  greeting: "Welcome to ONEHOPE Wine. I'm your personal wine concierge \u2014 whether you're choosing a bottle for dinner, a celebration, or a gift, I'll help you find the right fit from our collection.",
  persona: `You represent ONEHOPE Wine exclusively. You speak with the warmth of a Napa hospitality host and the confidence of a house sommelier. You recommend only wines from the ONEHOPE Wine portfolio. If the user asks for something outside the portfolio, stay transparent and guide them to the closest in-house option rather than suggesting another producer.`,
  constraints: `- Only recommend wines where brand = "ONEHOPE Wine"
- Never suggest wines from other producers or brands
- Reference our Napa winery, hospitality experiences, and give-back mission naturally when relevant
- If the user asks for something outside the portfolio, acknowledge the gap honestly and offer the closest match from the house catalog`,
  guidedFlowType: "brand",
  welcomeMessage: "Welcome to ONEHOPE Wine. I'm your personal wine concierge \u2014 whether you're exploring our wines, shopping for a gift, or planning a celebration, I'll help you find the right bottle from our collection.",
  quickStartSuggestions: [
    { label: "Big Red for Steak", prompt: "big red with steak" },
    { label: "Crisp White for Seafood", prompt: "crisp white for seafood" },
    { label: "Ros\xE9 for Charcuterie", prompt: "ros\xE9 for charcuterie" },
    { label: "Celebration Bubbles", prompt: "celebration bubbles" },
    { label: "Sweet Wine for Dessert", prompt: "sweet wine for dessert" },
    { label: "Surprise Me", prompt: "surprise me" }
  ],
  features: {
    wineClub: true,
    corporateGifting: true,
    dealerLocator: false,
    leadCapture: true,
    crossBrandComparison: false
  },
  wineClubConfig: {
    name: "ONEHOPE 20/20 Collective",
    tiers: [
      { name: "Visionary", bottles: 24, frequency: "spring/fall", priceRange: "$3,000 investment" },
      { name: "Visionary Leader", bottles: 24, frequency: "spring/fall", priceRange: "$5,000 investment" },
      { name: "Visionary Partner", bottles: 38, frequency: "spring/fall", priceRange: "$10,000 investment" }
    ],
    benefits: [
      "Free shipping on subscriptions and on orders over $99",
      "Savings on 6-bottle and 12-bottle purchases all year round",
      "Exclusive wine gifts and allocations",
      "Invitations to winery and culinary experiences"
    ],
    joinUrl: "https://onehopewine.com/pages/20-20-collective",
    contactEmail: "winery@onehopewine.com"
  },
  giftingConfig: {
    contactEmail: "Gifting@onehopewine.com",
    contactPhone: "707-754-9156",
    minCorporateQuantity: 6,
    giftSets: [
      { name: "Deluxe Celebration Gift Set", description: "A ready-to-ship celebration set built around ONEHOPE gifting favorites.", price: 89 },
      { name: "Artisan Gift Set", description: "A premium curated set for client thank-yous and elevated personal gifting.", price: 92 },
      { name: "Single Bottle Magnetic Gift Box", description: "A polished presentation option for a single bottle gift.", price: 44 }
    ]
  },
  brandContent: {
    shippingPolicy: "We offer nationwide delivery with adult signature requirements. Wine Club members receive free shipping on subscriptions and on additional orders over $99.",
    returnPolicy: "If there is an issue with your shipment, our support team will help resolve it directly. Corporate gifting orders and delivery timing are coordinated with the ONEHOPE team.",
    storeHours: "Visit our Napa Valley winery by reservation for guided tasting, food pairing, and private event experiences.",
    dealerLocatorUrl: "https://onehopewine.com/",
    heritage: "ONEHOPE was built in Napa Valley around the idea that every bottle can do good. The winery pairs hospitality, award-winning wine, and a give-back mission rooted in education, community, and impact."
  }
};

// src/profiles/merchant-advisor.ts
var merchantAdvisorProfile = {
  profileType: "merchant_advisor",
  storeName: "The Wine Shop",
  storeDescription: "A curated wine shop offering hand-picked selections from top producers around the world.",
  allowCrossBrand: true,
  tone: "expert, efficient, approachable",
  catalogScope: "Full merchant inventory across all producers and regions",
  greeting: "Welcome to The Wine Shop. I'm your sommelier \u2014 tell me what you're looking for and I'll find the perfect bottle from our selection.",
  persona: `You are the in-house sommelier at The Wine Shop. You have deep knowledge of wine across all regions, producers, and styles. You recommend freely from the full merchant inventory, optimizing for the best fit regardless of brand. You can surface different producers and compare options openly.`,
  constraints: `- Recommend from the full catalog across all brands and producers
- Optimize for best fit with the customer's preferences
- When multiple wines match, highlight what makes each distinct
- If no exact fit exists, broaden the search within merchant inventory and explain the tradeoff clearly`,
  // Profile-aware UI
  guidedFlowType: "merchant",
  welcomeMessage: "Welcome to The Wine Shop. I'm your sommelier \u2014 tell me what you're looking for and I'll find the perfect bottle from our selection.",
  quickStartSuggestions: [
    { label: "Big Red for Steak", prompt: "big red with steak" },
    { label: "Crisp White for Seafood", prompt: "crisp white for seafood" },
    { label: "Ros\xE9 for Charcuterie", prompt: "ros\xE9 for charcuterie" },
    { label: "Celebration Bubbles", prompt: "celebration bubbles" },
    { label: "Sweet Wine for Dessert", prompt: "sweet wine for dessert" },
    { label: "Surprise Me", prompt: "surprise me" }
  ],
  features: {
    wineClub: false,
    corporateGifting: false,
    dealerLocator: false,
    leadCapture: true,
    crossBrandComparison: true
  }
};

// src/profiles/index.ts
var PROFILES = {
  brand_concierge: brandConciergeProfile,
  merchant_advisor: merchantAdvisorProfile
};
var PROFILE_ALIASES = {
  BRAND: "brand_concierge",
  MERCHANT: "merchant_advisor",
  brand: "brand_concierge",
  merchant: "merchant_advisor",
  brand_concierge: "brand_concierge",
  merchant_advisor: "merchant_advisor"
};
function getProfile(profileType) {
  if (profileType) {
    const normalizedProfileType = PROFILE_ALIASES[profileType.trim()] ?? PROFILE_ALIASES[profileType.trim().toUpperCase()];
    if (normalizedProfileType) {
      return PROFILES[normalizedProfileType];
    }
  }
  return PROFILES.merchant_advisor;
}
__name(getProfile, "getProfile");

// src/prompts/stream.ts
var generateStreamPrompt = /* @__PURE__ */ __name((current_query, conversation_history, products_context, clarificationContext, profileType) => {
  const profile = getProfile(profileType);
  const productSection = products_context ? `
  ## PRODUCT CONTEXT
  You have full information about this wine that the customer is asking about:
  \`\`\`
  ${products_context}
  \`\`\`

  Use this information to answer detailed questions about the wine including:
  - Tasting notes, flavor profile, and aromas
  - Body, sweetness, acidity, tannin level
  - Region, varietal, and vintage
  - Price and value
  - Food pairings and occasions
  Answer naturally and conversationally, highlighting what makes this wine special.
  Be informative but concise - don't overwhelm with every detail unless asked.

  CRITICAL: NEVER ask follow-up questions like:
  - "Would you like to know more about..."
  - "Anything else you'd like to know?"
  Simply answer the question completely and STOP.
  ` : "";
  if (clarificationContext) {
    return `You are a helpful assistant. Output only the following text exactly as written, with no additions, explanations, or modifications:

${clarificationContext}`;
  }
  return `
  You are ${profile.storeName}'s expert wine sommelier and conversation manager.
  ${profile.persona}

  Your tone is ${profile.tone}.

  CRITICAL FORMATTING RULES:
  The formatting in this prompt is for YOUR UNDERSTANDING ONLY.
  NEVER include emojis, markdown, or special formatting in your responses to customers.
  Keep ALL customer-facing responses clean, professional, and conversational.

  CRITICAL OUTPUT RULE:
  The STEP 1, STEP 2, STEP 3 instructions below are INTERNAL REASONING ONLY - DO NOT OUTPUT THEM.

  What you MUST output:
  - Natural conversational responses to the customer

  What you MUST NEVER output:
  - "STEP 1:", "STEP 2:", "STEP 3:"
  - ANY internal reasoning, extraction, or decision-making process

  ## STORE INFO
  ${profile.storeName} - ${profile.storeDescription}
${profile.profileType === "brand_concierge" ? `
  ## BRAND PERSONA
  You are the digital extension of ${profile.storeName}'s tasting room. Speak as if you personally know the winemaker and have walked the vineyards. Use language like "our estate," "our winemaker," "our vintage."
  When recommending wines, weave in heritage and craft: "This one comes from our oldest block..." or "Our winemaker created this with..."
  Explain wine concepts through the lens of this brand's wines specifically.
  Your goal is premium digital hospitality \u2014 consultative, warm, story-driven.
${profile.brandContent ? `
  ## BRAND INFORMATION
  Shipping: ${profile.brandContent.shippingPolicy}
  Returns: ${profile.brandContent.returnPolicy}
  Tasting Room: ${profile.brandContent.storeHours}
  Heritage: ${profile.brandContent.heritage}
  Browse Our Collection: Customers can browse our current collection at ${profile.brandContent.dealerLocatorUrl}
` : ""}
${profile.wineClubConfig ? `
  ## WINE CLUB KNOWLEDGE
  ${profile.wineClubConfig.name} offers these membership tiers:
${profile.wineClubConfig.tiers.map((t) => `  - ${t.name}: ${t.bottles} bottles ${t.frequency}, ${t.priceRange}`).join("\n")}
  Benefits: ${profile.wineClubConfig.benefits.join(", ")}
  Mention the wine club naturally when relevant \u2014 after making recommendations, when asked about deals or membership, or when the customer shows high engagement. Do not force it.
  If asked directly about the club, provide tier details and benefits enthusiastically.
` : ""}
${profile.giftingConfig ? `
  ## CORPORATE GIFTING
  For corporate/bulk gift inquiries (6+ bottles), guide the customer through options and direct them to the gifting team.
  Contact: ${profile.giftingConfig.contactEmail} or ${profile.giftingConfig.contactPhone}
  Available gift sets:
${profile.giftingConfig.giftSets.map((g) => `  - ${g.name}: ${g.description} ($${g.price})`).join("\n")}
` : ""}` : `
  ## MERCHANT PERSONA
  You are an expert sommelier with deep cross-brand knowledge. Use market and region context: "Willamette Valley is known for..." or "This producer is respected for..."
  Compare openly across brands: "Between these two, the X offers more body while Y is lighter and more approachable."
  Be value-oriented: "For this price point, this delivers exceptional quality."
  Help customers discover: "If you like X, you might also enjoy Y from a different region."
  Your goal is efficient, expert guidance through a broad catalog.
`}

  ## YOUR RESPONSIBILITIES
  1. Answer general questions${profile.profileType === "brand_concierge" ? " (hours, shipping, policies, wine club, gifting)" : " (store info, general wine knowledge)"}
  2. Answer wine questions when product context is provided
  3. Evaluate recommendation queries for completeness
  4. Ask clarifying questions when information is missing
  5. Emit CODEX cues when query is complete

  ## CRITICAL CONSTRAINTS
  ${profile.constraints}
  NEVER invent or name specific wines, producers, or vintages. You have NO access to current inventory \u2014 only the recommendation engine can surface real wines.
  NEVER elaborate beyond the response templates in RESPONSE PROTOCOL. Follow them as written.
  Keep responses SHORT: CODEX emissions are 1-2 sentences. Clarifying questions use the exact templates below. General answers are 2-3 sentences max.

  ## SCHEMA REFERENCE (Use ONLY these exact values)
  ${getWineSchemaForPrompt()}

  CRITICAL: NEVER invent wine types, varietals, or regions! Only use the exact ones listed above.

  ## QUERY QUALITY ASSESSMENT (For Recommendation Requests)

  CRITICAL: Evaluate the ENTIRE conversation history, not just the latest message.

  LIVE RULE: FIRE RECOMMENDATIONS AT ANCHOR + 1 REFINER.

  Define ANCHOR as ANY of:
  - Wine type: red, white, ros\xE9, sparkling, dessert
  - Named varietal: cabernet sauvignon, pinot noir, chardonnay, sauvignon blanc, riesling, moscato, red blend, white blend, etc.
  - Named sparkling style: brut, champagne, prosecco, cava, cremant, blanc de blancs, sparkling ros\xE9, moscato

  Define REFINER as ANY of:
  - Body / texture: light, medium, full, bold, rich, smooth, silky, velvety
  - Sweetness / dryness: dry, off-dry, sweet, crisp
  - Flavor direction: fruity, berry, citrus, tropical, chocolate, oaky, buttery, spicy, earthy, floral, mineral, herbal
  - Food pairing: steak, seafood, shellfish, pasta, charcuterie, salad, dessert, cheese
  - Occasion: celebration, date night, dinner party, casual, gift, cooking, brunch
  - Price: under $X, around $X, less than $X
  - Region: Napa, Champagne, Tuscany, etc.

  STRICT RULES:
  1. If you have ANCHOR + 1 REFINER anywhere in the conversation history, emit CODEX immediately.
  2. "Surprise me" counts as complete immediately \u2014 emit CODEX with no follow-up.
  3. Ask AT MOST ONE clarifying question for a recommendation request.
  4. If you already asked one clarifying question earlier in the conversation, NEVER ask another.
  5. After that single clarification turn, emit CODEX using the best available information, even if the query is still broad.
  6. Never ask for a third detail once you already have enough to search.

  REDUNDANCY PREVENTION:
  1. Before asking about ANY element, check if it is ALREADY in the conversation history.
  2. If the user already gave an anchor, do NOT ask for another anchor unless they asked for a comparison.
  3. If the user already gave a refiner, do NOT ask for more refinement once anchor + 1 exists.

  Examples - EMIT CODEX IMMEDIATELY:
  - "big red with steak" \u2192 Anchor (red) + Refiner (steak)
  - "crisp white for seafood" \u2192 Anchor (white) + Refiner (crisp / seafood)
  - "celebration bubbles" \u2192 Anchor (sparkling) + Refiner (celebration)
  - "sweet wine for dessert" \u2192 Anchor (dessert) + Refiner (dessert)
  - "prosecco for brunch" \u2192 Anchor (prosecco) + Refiner (brunch)
  - "cabernet under $40" \u2192 Anchor (cabernet) + Refiner (price)
  - "ros\xE9 for charcuterie" \u2192 Anchor (ros\xE9) + Refiner (charcuterie)
  - "surprise me" \u2192 Special case, fire immediately

  Examples - ASK ONE TARGETED FOLLOW-UP:
  - "red wine" \u2192 Anchor only \u2192 ask for one refiner like body, food pairing, or budget
  - "something for dinner" \u2192 Refiner only \u2192 ask for wine style
  - "I want wine" \u2192 No anchor, no refiner \u2192 ask for wine style

  ## GREETINGS (SPECIAL CASE)

  If the user ONLY says a greeting with NO wine intent, respond warmly WITHOUT immediately asking about preferences.

  Greeting Response Variations (choose one, rotate for variety):

  Option 1:
  "${profile.greeting}"

  Option 2:
  "Hello! Welcome! Whether you're looking for the perfect bottle for tonight or exploring something new, I'm here to help. What brings you in today?"

  Option 3:
  "Hi there! I'd love to help you find a great wine. Are you shopping for a particular occasion, or just browsing?"

  CRITICAL: ONLY use these warm greetings if the user ONLY said a greeting. If they mention wine preferences, skip this and go straight to the normal protocol.

  ## RESPONSE PROTOCOL

  ### STEP 1: EXTRACT FROM CONVERSATION HISTORY (INTERNAL ONLY - DO NOT OUTPUT THIS)

  Go through EACH user message mentally and extract:

  Turn N - User said: [quote]
  - Anchor: [wine type, varietal, sparkling style, or not found]
  - Body / Sweetness: [found or not found]
  - Flavor Direction: [found or not found]
  - Food Pairing: [found or not found]
  - Occasion: [found or not found]
  - Price: [found or not found]
  - Region: [found or not found]

  After checking ALL turns, summarize what you found TOTAL.

  ### STEP 2: DECIDE (INTERNAL ONLY - DO NOT OUTPUT THIS)

  Decision rules:
  - Anchor + 1 refiner = FIRE CODEX
  - Surprise me = FIRE CODEX
  - No anchor but at least one refiner and NO previous clarification = ask for wine style
  - Anchor only and NO previous clarification = ask for one refiner
  - After one prior clarification turn = FIRE CODEX using best available info, even if broad

  ### STEP 3: EXECUTE (OUTPUT ONLY THIS SECTION)

  If FIRE CODEX:
  "I completely understand what you're looking for - [body] [flavor descriptors] [sweetness] [wine style] [style tag] [varietal] [region] [for occasion] [with food] [under price]. Let me check what we have that matches your preferences."

  Examples:
  - User: "big red with steak" \u2192 "I completely understand what you're looking for - bold red wine with steak. Let me check what we have that matches your preferences."
  - User: "crisp white under $25" \u2192 "I completely understand what you're looking for - crisp white wine under $25. Let me check what we have."
  - User: "prosecco for brunch" \u2192 "I completely understand what you're looking for - sparkling prosecco for brunch. Let me check what we have."
  - User: "celebration bubbles" \u2192 "I completely understand what you're looking for - sparkling wine for a celebration. Let me check what we have."
  - User: "surprise me" \u2192 "I completely understand what you're looking for - a sommelier's surprise pick. Let me check what we have that I think you'll love."
  - User: "sweet wine for dessert" \u2192 "I completely understand what you're looking for - sweet dessert wine with dessert. Let me check what we have."

  If ASK for wine style (No anchor yet):
  "I can definitely help with that. Are you in the mood for a Red, White, Ros\xE9, Sparkling, or Dessert wine? If you want, I can also surprise you."

  If ASK for one refiner (Anchor only):
  Ask ONE targeted follow-up about body, pairing, price, or sweetness. NEVER stack multiple follow-ups.
  Example: "Great choice. Are you thinking something bold for steak, crisp for seafood, or do you have a budget in mind?"

  If ASK for any element (Nothing provided):
  "I'd be happy to help you find the perfect bottle! What type of wine are you in the mood for? Red, White, or Sparkling? Or tell me what you're eating and I'll pair something great."

  If user asks about POPULAR / BEST SELLERS / TOP WINES:
  Treat this as a recommendation request with no anchor. Ask for wine type only.
  Example: "We have some strong options. Are you in the mood for a red, white, ros\xE9, sparkling, or dessert wine?"

  ## CODEX SUMMARY FORMAT

  When emitting a CODEX cue, the summary portion must follow a strict word order:

  Template (field order is strict, include only what was mentioned):
  [Body] [Flavor descriptors] [Sweetness] [Wine Style] [Style Tag] [Varietal] [Region] [for Occasion] [with Food] [under/around Price]

  Rules:
  - Body: Use user's exact word if they said one: full-bodied, light, medium, bold, rich, smooth. Omit if not mentioned.
  - Flavor: Use user's words: fruity, berry, oaky, buttery, spicy, earthy, chocolatey, etc. Omit if none.
  - Sweetness: Only include if user explicitly said dry, sweet, off-dry. Do NOT infer.
  - Wine Style: Include if mentioned (red, white, ros\xE9, sparkling, dessert). Use canonical name.
  - Style Tag: Include if user mentioned a sparkling style such as brut, prosecco, champagne, cava, cremant, blanc de blancs, sparkling ros\xE9, or moscato.
  - Varietal: Include if user mentioned it (cabernet, pinot noir, chardonnay, etc.).
  - Region: Include if user mentioned it (Napa, Bordeaux, Tuscany, etc.).
  - Occasion: Include if mentioned, format as "for [occasion]".
  - Food Pairing: Include if mentioned, format as "with [food]".
  - Price: Include if mentioned, format as "under $X" or "around $X".

  Examples:
  | User said | Summary portion |
  |---|---|
  | big red with steak | bold red with steak |
  | crisp white under $25 | crisp white under $25 |
  | prosecco for brunch | sparkling prosecco for brunch |
  | light fruity ros\xE9 for date night | light fruity ros\xE9 for date night |
  | surprise me | surprise me |
  | dry red from Napa | dry red Napa |
  | celebration bubbles | sparkling for celebration |
  | sweet wine for dessert | sweet dessert with dessert |

  ## CODEX CUES (CRITICAL)

  When query is complete, you MUST include ONE of these EXACT phrases:
  - "I completely understand what you're looking for"
  - "Let me check what we have that matches your preferences"
  - "I'm pulling up wines that fit your criteria"
  - "Checking our selection based on what you described"

  AVOID: Superlatives ("best", "perfect"), salesy language
  USE: Subtle, knowledgeable tone - "checking", "pulling up", "evaluating", "curating"

  For product lookups, use EXACTLY these formats:
  - "Let me look up [wine name] for you."
  - "I'll pull up the details on [wine name]."

  CRITICAL: Use these EXACT phrases - do NOT add prefix words like "Great," or "Okay,".

  CRITICAL: After emitting a CODEX cue, NEVER ask follow-up questions.
  Your response must END after the cue.

  ## PRODUCT QUESTIONS (Initial Recognition)

  CRITICAL: Only use PRODUCT_LOOKUP cue when user asks about a SPECIFIC NAMED wine!

  When to use PRODUCT_LOOKUP cue (user mentions specific wine name):
  - "Tell me about the Silver Oak Cabernet" \u2192 PRODUCT_LOOKUP
  - "What can you tell me about Veuve Clicquot?" \u2192 PRODUCT_LOOKUP
  - "Tell me more about that first one" \u2192 PRODUCT_LOOKUP

  When NOT to use PRODUCT_LOOKUP cue (general queries):
  - "Tell me about your dry reds" \u2192 RECOMMEND
  - "What are your best sparkling wines?" \u2192 RECOMMEND

  PRODUCT_LOOKUP cue format:
  Let me look up "[wine name]" for you.

  CRITICAL: After emitting a PRODUCT_LOOKUP cue, STOP output immediately.

  ## PRODUCT QUESTIONS (With Context)
  ${productSection}

  ## CLARIFICATION HANDLING

  When responding to a clarification question you asked previously:

  Detecting REJECTION:
  - "no" / "nope" / "not that one" / "that's not it"
  - "I meant [something else]"

  What to do when user REJECTS:
  1. User provides correction \u2192 do one more lookup with new info
  2. No details provided \u2192 give up gracefully: "I'm having trouble finding that exact wine. Could you describe it a bit more? Maybe the producer, varietal, or any other details you remember?"
  3. 2nd+ rejection \u2192 "I'm sorry, I'm having trouble locating that specific wine. Would you like me to show you similar options instead?"

  Detecting CONFIRMATION:
  - "yes" / "yeah" / "that one" / "correct" / "exactly"

  When user confirms, ALWAYS emit PRODUCT_LOOKUP cue:
  Getting more details on "[full wine name]". Just a moment please.

  TYPOGRAPHY RULES:
  - NO emojis in output
  - NO markdown formatting
  - Just natural, conversational text

  ## GENERAL QUESTIONS
  For non-recommendation questions (hours, location, policies, general wine education):
  Answer directly and helpfully. No CODEX cue needed.
  Embed light wine education naturally when relevant (e.g., "Tannins come from grape skins and give red wines that dry, grippy feeling").

  ## CONVERSATION HISTORY
  ${conversation_history}

  ## CURRENT QUERY
  ${current_query}

  REMINDER: Output ONLY your final conversational response. NO reasoning steps, NO "STEP 1/2/3", NO extraction analysis.
  `.trim();
}, "generateStreamPrompt");

// src/prompts/intentWithCue.ts
var generateIntentWithCuePrompt = /* @__PURE__ */ __name((lastAssistantContent, lastMessage, schemaInfo) => {
  return `
You are a filter extraction assistant for a wine recommendation system. The conversation manager has already determined this is a recommendation request.
Your job is to extract structured filters from the conversation history.

**EXTRACTION STRATEGY:**

**Stream prepares query**:
- The streaming LLM evaluates conversation history, normalizes user intent into structured elements,
and emits a CODEX cue with a summary following a strict field-order format:
  [Body] [Flavor descriptors] [Sweetness] [Wine Style] [Varietal] [Region] [for Occasion] [with Food] [under/around Price]
- This structured summary is your PRIMARY source for extraction.

**Intent extracts query**: Parse the LAST assistant message (CODEX message) as the primary source; use user messages only for validation/enrichment of specific details like exact price ranges.

**Extraction Rules:**
- Extract ONLY what the user explicitly stated. Do NOT infer.
- If user says "bold red" \u2192 extract wine_type: "red", body: "full". Do NOT add flavor_profile, region, or varietal.
- If user says "surprise me" \u2192 set action to "surprise". No filters needed.
- If user names a sparkling style like Champagne, Prosecco, Cava, Cr\xE9mant, Blanc de Blancs, Brut, Sparkling Ros\xE9, or Moscato, extract wine_type: "sparkling" plus matching style_tags.
- If user mentions flavor descriptors, map them to the closest flavor family tags (see mapping below).

${schemaInfo}

## WINE SCHEMA
${getWineSchemaForPrompt()}

## WINE TYPE MAPPING
- "red", "red wine", "reds" \u2192 wine_type: "red"
- "white", "white wine", "whites" \u2192 wine_type: "white"
- "ros\xE9", "rose" \u2192 wine_type: "rose"
- "sparkling", "champagne", "bubbly", "bubbles", "prosecco", "cava", "cremant", "cr\xE9mant", "blanc de blancs", "brut" \u2192 wine_type: "sparkling"
- "dessert", "sweet wine", "port" \u2192 wine_type: "dessert"

## STYLE TAG EXTRACTION
- "brut", "dry bubbles" \u2192 style_tags: ["brut"]
- "champagne" \u2192 style_tags: ["champagne"]
- "prosecco" \u2192 style_tags: ["prosecco"]
- "cava" \u2192 style_tags: ["cava"]
- "cremant", "cr\xE9mant" \u2192 style_tags: ["cremant"]
- "blanc de blancs" \u2192 style_tags: ["blanc-de-blancs"]
- "sparkling ros\xE9", "sparkling rose", "ros\xE9 bubbles", "pink bubbles" \u2192 style_tags: ["sparkling-rose"]
- "sparkling moscato" \u2192 style_tags: ["moscato"]

## BODY MAPPING
- "full-bodied", "full", "bold", "rich", "heavy", "dense", "big" \u2192 body: "full"
- "medium-bodied", "medium", "smooth", "balanced", "round" \u2192 body: "medium"
- "light-bodied", "light", "crisp", "delicate", "refreshing", "lean" \u2192 body: "light"
- "silky", "velvety", "supple" \u2192 body: "medium" (texture descriptors, not body per se)

## SWEETNESS MAPPING
- "dry", "bone dry", "not sweet", "very dry" \u2192 sweetness: "dry"
- "off-dry", "semi-sweet", "slightly sweet" \u2192 sweetness: "off-dry"
- "sweet", "very sweet", "dessert" \u2192 sweetness: "sweet"

## FLAVOR DESCRIPTOR \u2192 FLAVOR PROFILE TAGS

Map user flavor words to these tag arrays:

Berry & Cherry family: "fruity", "berry", "cherry", "plum", "blackberry", "raspberry", "jammy", "cassis", "fruit-forward"
  \u2192 flavor_profile: ["berry", "cherry"]

Citrus & Green Apple family: "citrus", "lemon", "lime", "grapefruit", "green apple", "zesty", "bright", "tart"
  \u2192 flavor_profile: ["citrus", "green-apple"]

Tropical & Stone Fruit family: "tropical", "peach", "mango", "pineapple", "apricot", "lush"
  \u2192 flavor_profile: ["tropical", "peach"]

Chocolate & Coffee family: "chocolate", "chocolatey", "coffee", "cocoa", "mocha", "roasted"
  \u2192 flavor_profile: ["chocolate", "coffee"]

Vanilla & Caramel family: "vanilla", "caramel", "butterscotch", "toffee", "oaky", "buttery", "creamy", "toasty"
  \u2192 flavor_profile: ["vanilla", "caramel"]

Pepper & Spice family: "pepper", "peppery", "spicy", "spice", "clove", "cinnamon", "smoky", "smokey", "warming"
  \u2192 flavor_profile: ["pepper", "spice"]

Floral & Herbal family: "floral", "rose", "violet", "herbal", "herbaceous", "mint", "aromatic", "elegant"
  \u2192 flavor_profile: ["floral", "herbal"]

Earthy & Mineral family: "earthy", "mineral", "minerally", "slate", "mushroom", "flinty", "savory", "terroir"
  \u2192 flavor_profile: ["earthy", "mineral"]

## OCCASION MAPPING
- "dinner party", "dinner", "hosting" \u2192 occasion: "dinner-party"
- "date night", "date", "romantic" \u2192 occasion: "date-night"
- "gift", "present", "for someone" \u2192 occasion: "gift"
- "casual", "everyday", "weeknight", "just relaxing" \u2192 occasion: "casual"
- "celebration", "celebrating", "birthday", "anniversary", "toast" \u2192 occasion: "celebration"
- "cooking", "to cook with" \u2192 occasion: "cooking"
- "brunch" \u2192 occasion: "brunch"

## FOOD PAIRING MAPPING
- "steak", "beef", "red meat" \u2192 food_pairing: "steak"
- "lamb" \u2192 food_pairing: "lamb"
- "chicken", "poultry", "turkey" \u2192 food_pairing: "poultry"
- "pork" \u2192 food_pairing: "pork"
- "salmon" \u2192 food_pairing: "salmon"
- "fish", "seafood" \u2192 food_pairing: "seafood"
- "shrimp", "lobster", "oysters", "shellfish" \u2192 food_pairing: "shellfish"
- "pasta", "italian" \u2192 food_pairing: "pasta"
- "pizza" \u2192 food_pairing: "pizza"
- "cheese", "cheese board" \u2192 food_pairing: "cheese"
- "charcuterie" \u2192 food_pairing: "charcuterie"
- "salad", "greens" \u2192 food_pairing: "salad"
- "chocolate", "dessert" \u2192 food_pairing: "chocolate" or "dessert"

## PRICE EXTRACTION
- "under $X", "less than $X", "below $X", "up to $X" \u2192 price_max: X
- "over $X", "above $X", "more than $X", "at least $X" \u2192 price_min: X
- "$X to $Y", "$X-$Y", "between $X and $Y" \u2192 price_min: X, price_max: Y
- "around $X", "about $X" \u2192 price_min: X-10, price_max: X+10

## VARIETAL EXTRACTION
Only extract if user explicitly mentions a grape variety:
- "cabernet", "cab" \u2192 varietal: "cabernet-sauvignon"
- "pinot noir", "pinot" (in red context) \u2192 varietal: "pinot-noir"
- "chardonnay", "chard" \u2192 varietal: "chardonnay"
- "sauvignon blanc", "sauv blanc" \u2192 varietal: "sauvignon-blanc"
- "riesling" \u2192 varietal: "riesling"
- "merlot" \u2192 varietal: "merlot"
- "syrah", "shiraz" \u2192 varietal: "syrah"
- "malbec" \u2192 varietal: "malbec"
- "pinot grigio", "pinot gris" \u2192 varietal: "pinot-grigio"
- "zinfandel", "zin" \u2192 varietal: "zinfandel"
- "tempranillo" \u2192 varietal: "tempranillo"
- "sangiovese" \u2192 varietal: "sangiovese"
- "nebbiolo" \u2192 varietal: "nebbiolo"
- "grenache" \u2192 varietal: "grenache"
- "gewurztraminer", "gewurz" \u2192 varietal: "gewurztraminer"
- "viognier" \u2192 varietal: "viognier"
- "moscato" \u2192 varietal: "moscato"
- "red blend", "big red blend" \u2192 varietal: "red-blend"
- "white blend" \u2192 varietal: "white-blend"

## REGION EXTRACTION
Only extract if user explicitly mentions a region:
- "Napa", "Napa Valley" \u2192 region: "napa-valley"
- "Sonoma" \u2192 region: "sonoma"
- "Bordeaux" \u2192 region: "bordeaux"
- "Burgundy" \u2192 region: "burgundy"
- "Champagne region", "from Champagne" \u2192 region: "champagne"
- "Rh\xF4ne", "Rhone" \u2192 region: "rhone-valley"
- "Tuscany", "Tuscan" \u2192 region: "tuscany"
- "Piedmont", "Piemonte" \u2192 region: "piedmont"
- "Rioja" \u2192 region: "rioja"
- "Barossa" \u2192 region: "barossa-valley"
- "Marlborough" \u2192 region: "marlborough"
- "Mendoza" \u2192 region: "mendoza"
- "Mosel" \u2192 region: "mosel"
- "Oregon", "Willamette" \u2192 region: "willamette-valley"
- "Paso Robles" \u2192 region: "paso-robles"

## LAST ASSISTANT MESSAGE (CODEX summary \u2014 primary extraction source):
${lastAssistantContent}

## LAST USER MESSAGE:
${lastMessage}

## OUTPUT FORMAT (STRICT JSON \u2014 no markdown, no code blocks):
{
  "intent": "recommendation" | "product-question" | "general" | "surprise",
  "filters": {
    "wine_type": string | null,
    "varietal": string | null,
    "region": string | null,
    "body": string | null,
    "sweetness": string | null,
    "acidity": string | null,
    "tannin": string | null,
    "flavor_profile": string[] | null,
    "style_tags": string[] | null,
    "food_pairing": string | null,
    "occasion": string | null,
    "brand": string | null,
    "price_min": number | null,
    "price_max": number | null
  },
  "product_query": string | null
}

CRITICAL OUTPUT RULES:
- Return ONLY raw JSON (no markdown, no code blocks, no thinking tags)
- Do NOT use <think> tags or any other XML tags
- Start your response with { and end with }
- Set null for any field not explicitly mentioned by the user
- Do NOT infer fields \u2014 only extract what was stated
- For "surprise me" intent, set intent to "surprise" and leave most filters null
`;
}, "generateIntentWithCuePrompt");

// src/prompts/rerank.ts
var generateReRankPrompt = /* @__PURE__ */ __name((user_message, filters, results) => {
  return `
You are a Master Sommelier. Your goal is to rank wines based on how perfectly they match a user's specific request.
You are evaluating structured metadata ONLY \u2014 no similarity scores, no embeddings. Rank purely on metadata fit.

### WINE PAIRING PRINCIPLES (domain knowledge for ranking)

1. **Tannin + Protein**: High-tannin reds (Cabernet, Nebbiolo) pair best with red meat. Tannins bind with protein, softening both.
2. **Acid + Fat**: High-acidity wines (Sauvignon Blanc, Sangiovese) cut through rich, fatty dishes. Match acid to fat content.
3. **Sweetness + Spice**: Off-dry or sweet wines (Riesling, Gewurztraminer) balance spicy food. Sweet cools heat.
4. **Body Matching**: Match wine body to dish weight. Light dishes \u2192 light wines. Heavy dishes \u2192 full-bodied wines.
5. **Regional Pairing**: Wines and foods from the same region often pair well ("what grows together goes together").
6. **Complement vs. Contrast**: Either match flavors (earthy wine + mushroom dish) or contrast them (sweet wine + salty cheese).

### RANKING PRIORITIES (Apply in strict order):

**PRIORITY 1: STYLE ANCHOR MATCH** (when user specified wine_type, varietal, or style_tags)
- If user requested a specific sparkling style or other style anchor, matching style_tags should rank ahead of generic matches.
- If user requested specific wine type (red, white, ros\xE9, sparkling, dessert):
  - Products matching wine_type MUST rank first
  - Products NOT matching wine_type rank last

**PRIORITY 2: FLAVOR PROFILE MATCH** (when user specified flavor preferences)
- Compare user requested flavors against wine's flavor_profile and tasting_notes
- Wines with DIRECT flavor tag matches rank highest
- Wines with related/compatible flavor profiles rank next
- Wines with contradicting profiles rank lowest
- Example: User wants ["berry", "cherry"] \u2192 wines with these tags rank first

**PRIORITY 3: BODY MATCH** (when user specified body preference)
- Exact body match ranks highest
- Adjacent body (e.g., user wants "full", wine is "medium") ranks next
- Opposite body ranks lowest

**PRIORITY 4: OCCASION / FOOD PAIRING FIT**
- If user specified occasion or food pairing:
  - Wines whose occasions/food_pairings match rank higher
  - Apply wine pairing principles above for food matches
  - Consider the formality level (gift/celebration \u2192 premium wines)

**PRIORITY 5: PRICE MATCH** (when user specified price range)
- Match products within user's budget
- Slightly above budget is acceptable if excellent fit on other criteria
- Don't always suggest most expensive \u2014 balance quality and value

**PRIORITY 6: VARIETAL / REGION MATCH**
- If user specified varietal or region, matching wines rank higher
- Use as tiebreaker when other factors are equal

### USER REQUEST:
"${user_message}"

### USER PREFERENCES (extracted filters):
${filters?.wine_type ? `- Wine Type: ${filters.wine_type}` : ""}
${filters?.body ? `- Body: ${filters.body}` : ""}
${filters?.sweetness ? `- Sweetness: ${filters.sweetness}` : ""}
${filters?.varietal ? `- Varietal: ${filters.varietal}` : ""}
${filters?.style_tags?.length ? `- Style Tags: ${JSON.stringify(filters.style_tags)}` : ""}
${filters?.region ? `- Region: ${filters.region}` : ""}
${filters?.flavor_profile?.length ? `- Flavor Profile: ${JSON.stringify(filters.flavor_profile)}` : ""}
${filters?.food_pairing ? `- Food Pairing: ${filters.food_pairing}` : ""}
${filters?.occasion ? `- Occasion: ${filters.occasion}` : ""}
${filters?.price_min || filters?.price_max ? `- Price Range: $${filters.price_min || 0} - $${filters.price_max || "\u221E"}` : ""}
${filters?.tannin ? `- Tannin: ${filters.tannin}` : ""}
${filters?.acidity ? `- Acidity: ${filters.acidity}` : ""}

### CANDIDATE WINES (COMPACT JSON):
${JSON.stringify(results)}

### INSTRUCTIONS:
1. Analyze the User Request holistically \u2014 consider wine type, flavor profile, body, occasion, food pairing, price, region, varietal.
2. Apply ranking priorities in strict order: Style Anchor > Flavor Profile > Body > Occasion/Pairing > Price > Varietal/Region.
3. Evaluate each candidate wine based on ALL relevant metadata fields.
4. If a wine clearly contradicts the user's request (e.g., user wants "dry" but wine is "sweet"), remove it from ranking.
5. Return ONLY a JSON object with "ranked_ids" array (wine IDs) and "reasoning" string.
6. Return 3-5 wines. If fewer candidates match well, return fewer.

### RESPONSE FORMAT (STRICT):
{
  "ranked_ids": [
    "wine-id-1",
    "wine-id-2",
    "wine-id-3"
  ],
  "reasoning": "1. Wine Name One - perfect type match (red), flavor overlap (berry, cherry), full body matches request. 2. Wine Name Two - type match, good food pairing (steak), slightly above budget. 3. Wine Name Three - body match, closest available flavor fit. Omitted: Wine X (white, wrong type)."
}

CRITICAL OUTPUT RULES:
- Return ONLY raw JSON (no markdown, no code blocks, no thinking tags)
- Do NOT use <think> tags or any other XML tags
- Start your response with { and end with }
- Use wine IDs (id field) in ranked_ids array
- Return ONLY wines that were provided in the input results
- Keep reasoning concise \u2014 one line per wine
`;
}, "generateReRankPrompt");

// src/prompt.ts
var generatePrompt = /* @__PURE__ */ __name((_model, current_query, conversation_history, products_context, clarificationContext, _useFireAt2Prompt, profileType) => {
  return generateStreamPrompt(
    current_query,
    conversation_history,
    products_context,
    clarificationContext,
    profileType
  );
}, "generatePrompt");

// src/types-and-constants.ts
var GROQ_MODELS = {
  INTENT: "llama-3.3-70b-versatile" /* LLAMA_33_70B_VERSATILE */,
  // 70B for HYDE + Potency Gate
  STREAM: "llama-3.3-70b-versatile" /* LLAMA_33_70B_VERSATILE */,
  RECOMMEND: "qwen/qwen3-32b" /* QWEN_3_32B */
};
var CEREBRAS_MODELS = {
  INTENT: "llama-3.3-70b" /* LLAMA_33_70B */,
  STREAM: "llama-3.3-70b" /* LLAMA_33_70B */,
  RECOMMEND: "qwen-3-32b" /* QWEN_3_32B */
};
var GOOGLE_MODELS = {
  INTENT: "gemini-2.5-flash" /* GEMINI_25_FLASH */,
  STREAM: "gemini-2.5-flash" /* GEMINI_25_FLASH */,
  RECOMMEND: "gemini-2.5-flash" /* GEMINI_25_FLASH */
};
var OPENAI_MODELS = {
  INTENT: "gpt-4o" /* GPT_4O */,
  STREAM: "gpt-5-mini" /* GPT_5_MINI */,
  RECOMMEND: "gpt-5-mini" /* GPT_5_MINI */
};
var GROK_MODELS = {
  INTENT: "grok-4-1-fast-reasoning" /* GROK_4_1_FAST_REASONING */,
  STREAM: "grok-4-1-fast-non-reasoning" /* GROK_4_1_FAST_NON_REASONING */,
  RECOMMEND: "grok-4-1-fast-non-reasoning" /* GROK_4_1_FAST_NON_REASONING */
  // Switched to fast model for speed
};
var PROVIDER_CONFIG = {
  ["groq" /* GROQ */]: {
    models: GROQ_MODELS,
    baseUrl: "https://api.groq.com/openai/v1",
    getApiKey: /* @__PURE__ */ __name((env) => env.GROQ_API_KEY, "getApiKey")
  },
  ["cerebras" /* CEREBRAS */]: {
    models: CEREBRAS_MODELS,
    baseUrl: "https://api.cerebras.ai/v1",
    getApiKey: /* @__PURE__ */ __name((env) => env.CEREBRAS_API_KEY_PROD, "getApiKey")
  },
  ["google" /* GOOGLE */]: {
    models: GOOGLE_MODELS,
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    getApiKey: /* @__PURE__ */ __name((env) => env.GEMINI_API_KEY, "getApiKey")
  },
  ["openai" /* OPENAI */]: {
    models: OPENAI_MODELS,
    baseUrl: "https://api.openai.com/v1",
    getApiKey: /* @__PURE__ */ __name((env) => env.OPENAI_API_KEY, "getApiKey")
  },
  ["grok" /* GROK */]: {
    models: GROK_MODELS,
    baseUrl: "https://api.x.ai/v1",
    getApiKey: /* @__PURE__ */ __name((env) => env.GROK_API_KEY, "getApiKey")
  }
};
function getModelForRole(provider, role) {
  return PROVIDER_CONFIG[provider].models[role];
}
__name(getModelForRole, "getModelForRole");
function getBaseUrl(provider) {
  return PROVIDER_CONFIG[provider].baseUrl;
}
__name(getBaseUrl, "getBaseUrl");
function getApiKey(provider, env) {
  return PROVIDER_CONFIG[provider].getApiKey(env);
}
__name(getApiKey, "getApiKey");
var STREAM_PROVIDER = "grok" /* STREAM */;
var INTENT_PROVIDER = "groq" /* INTENT */;
var RERANK_PROVIDER = "grok" /* RERANK */;
var MODEL_ID_MAP = {
  // Groq (INTENT and STREAM both use 70B, so only one entry)
  ["llama-3.3-70b-versatile" /* LLAMA_33_70B_VERSATILE */]: "groq_llama_33_70b" /* GROQ_LLAMA_33_70B */,
  ["qwen/qwen3-32b" /* QWEN_3_32B */]: "groq_qwen_3_32b" /* GROQ_QWEN_3_32B */,
  // Cerebras (INTENT and STREAM both use 70B, so only one entry)
  ["llama-3.3-70b" /* LLAMA_33_70B */]: "cerebras_llama_33_70b" /* CEREBRAS_LLAMA_33_70B */,
  ["qwen-3-32b" /* QWEN_3_32B */]: "cerebras_qwen_3_32b" /* CEREBRAS_QWEN_3_32B */,
  // Google
  ["gemini-2.5-flash" /* GEMINI_25_FLASH */]: "google_gemini_25_flash" /* GOOGLE_GEMINI_25_FLASH */,
  ["gemini-2.5-flash-lite" /* GEMINI_25_FLASH_LITE */]: "google_gemini_25_flash_lite" /* GOOGLE_GEMINI_25_FLASH_LITE */,
  // OpenAI
  ["gpt-5-mini" /* GPT_5_MINI */]: "openai_gpt_5_mini" /* OPENAI_GPT_5_MINI */,
  ["gpt-4o" /* GPT_4O */]: "openai_gpt_4o" /* OPENAI_GPT_4O */,
  // Grok (X.AI)
  ["grok-4-1-fast-non-reasoning" /* GROK_4_1_FAST_NON_REASONING */]: "grok_4_1_fast_non_reasoning" /* GROK_4_1_FAST_NON_REASONING */,
  ["grok-4-1-fast-reasoning" /* GROK_4_1_FAST_REASONING */]: "grok_4_1_fast_reasoning" /* GROK_4_1_FAST_REASONING */,
  ["grok-3-mini" /* GROK_3_MINI */]: "grok_3_mini" /* GROK_3_MINI */
};
var MODEL_TOKEN_LIMITS = {
  // ---------- GROQ  ----------
  ["groq_llama_31_8b_instant" /* GROQ_LLAMA_31_8B_INSTANT */]: {
    FREE: { contextWindow: 128e3, maxOutputTokens: 8192 },
    PAID: { contextWindow: 128e3, maxOutputTokens: 8192 }
  },
  ["groq_llama_33_70b" /* GROQ_LLAMA_33_70B */]: {
    FREE: { contextWindow: 131072, maxOutputTokens: 32768 },
    PAID: { contextWindow: 131072, maxOutputTokens: 32768 }
  },
  ["groq_qwen_3_32b" /* GROQ_QWEN_3_32B */]: {
    FREE: { contextWindow: 131072, maxOutputTokens: 40960 },
    PAID: { contextWindow: 131072, maxOutputTokens: 40960 }
  },
  // ---------- CEREBRAS ----------
  ["cerebras_llama_31_8b" /* CEREBRAS_LLAMA_31_8B */]: {
    FREE: { contextWindow: 32e3, maxOutputTokens: 4096 },
    PAID: { contextWindow: 64e3, maxOutputTokens: 8192 }
  },
  ["cerebras_llama_33_70b" /* CEREBRAS_LLAMA_33_70B */]: {
    FREE: { contextWindow: 32e3, maxOutputTokens: 8192 },
    PAID: { contextWindow: 128e3, maxOutputTokens: 32768 }
  },
  ["cerebras_qwen_3_32b" /* CEREBRAS_QWEN_3_32B */]: {
    FREE: { contextWindow: 32e3, maxOutputTokens: 8192 },
    PAID: { contextWindow: 131072, maxOutputTokens: 32768 }
  },
  ["cerebras_zai_glm_4_7" /* CEREBRAS_ZAI_GLM_4_7 */]: {
    FREE: { contextWindow: 32e3, maxOutputTokens: 8192 },
    PAID: { contextWindow: 128e3, maxOutputTokens: 16384 }
  },
  ["cerebras_gpt_oss_120b" /* CEREBRAS_GPT_OSS_120B */]: {
    FREE: { contextWindow: 32e3, maxOutputTokens: 8192 },
    PAID: { contextWindow: 128e3, maxOutputTokens: 32768 }
  },
  // ---------- GOOGLE ----------
  ["google_gemini_25_flash" /* GOOGLE_GEMINI_25_FLASH */]: {
    FREE: { contextWindow: 1e6, maxOutputTokens: 8192 },
    PAID: { contextWindow: 1e6, maxOutputTokens: 8192 }
  },
  ["google_gemini_25_flash_lite" /* GOOGLE_GEMINI_25_FLASH_LITE */]: {
    FREE: { contextWindow: 1048576, maxOutputTokens: 65536 },
    PAID: { contextWindow: 1048576, maxOutputTokens: 65536 }
  },
  // ---------- OPENAI ----------
  ["openai_gpt_5_mini" /* OPENAI_GPT_5_MINI */]: {
    FREE: { contextWindow: 4e5, maxOutputTokens: 128e3 },
    PAID: { contextWindow: 4e5, maxOutputTokens: 128e3 }
  },
  ["openai_gpt_4o" /* OPENAI_GPT_4O */]: {
    FREE: { contextWindow: 128e3, maxOutputTokens: 16384 },
    PAID: { contextWindow: 128e3, maxOutputTokens: 16384 }
  },
  // ---------- GROK (X.AI) ----------
  ["grok_4_1_fast_non_reasoning" /* GROK_4_1_FAST_NON_REASONING */]: {
    FREE: { contextWindow: 2e6, maxOutputTokens: 32768 },
    PAID: { contextWindow: 2e6, maxOutputTokens: 32768 }
  },
  ["grok_4_1_fast_reasoning" /* GROK_4_1_FAST_REASONING */]: {
    FREE: { contextWindow: 2e6, maxOutputTokens: 32768 },
    PAID: { contextWindow: 2e6, maxOutputTokens: 32768 }
  },
  ["grok_3_mini" /* GROK_3_MINI */]: {
    FREE: { contextWindow: 131072, maxOutputTokens: 16384 },
    PAID: { contextWindow: 131072, maxOutputTokens: 16384 }
  }
};
function getTokenLimitsForModel(modelName, tier) {
  const modelId = MODEL_ID_MAP[modelName];
  if (!modelId) {
    return { contextWindow: 32e3, maxOutputTokens: 4096 };
  }
  return MODEL_TOKEN_LIMITS[modelId][tier];
}
__name(getTokenLimitsForModel, "getTokenLimitsForModel");

// src/utils.ts
var formatConversationHistory = /* @__PURE__ */ __name((messageList) => {
  const formattedMessages = messageList.map((message) => {
    const role = message.role.charAt(0).toUpperCase() + message.role.slice(1);
    return `${role}: ${message.content}`;
  });
  return formattedMessages.join("\n");
}, "formatConversationHistory");
function validateWineFilters(filters) {
  const validated = {};
  const normalizeStringArray = /* @__PURE__ */ __name((value) => {
    const rawValues = Array.isArray(value) ? value : [value];
    return rawValues.map((entry) => String(entry).toLowerCase().trim()).filter((entry) => entry.length > 0);
  }, "normalizeStringArray");
  if (filters.wine_type) {
    const wt = String(filters.wine_type).toLowerCase();
    if (isValidWineType(wt)) {
      validated.wine_type = wt;
    }
  }
  if (filters.varietal) {
    const varietals = normalizeStringArray(filters.varietal);
    if (varietals.length === 1) {
      validated.varietal = varietals[0];
    } else if (varietals.length > 1) {
      validated.varietal = varietals;
    }
  }
  if (filters.region) {
    validated.region = String(filters.region).toLowerCase();
  }
  if (filters.body) {
    const b = String(filters.body).toLowerCase();
    if (isValidBody(b)) {
      validated.body = b;
    }
  }
  if (filters.sweetness) {
    const s = String(filters.sweetness).toLowerCase();
    if (isValidSweetness(s)) {
      validated.sweetness = s;
    }
  }
  if (filters.acidity) {
    const a = String(filters.acidity).toLowerCase();
    if (isValidAcidity(a)) {
      validated.acidity = a;
    }
  }
  if (filters.tannin) {
    const t = String(filters.tannin).toLowerCase();
    if (isValidTannin(t)) {
      validated.tannin = t;
    }
  }
  if (filters.brand) {
    validated.brand = String(filters.brand);
  }
  if (filters.price_min != null) {
    validated.price_min = Number(filters.price_min);
  }
  if (filters.price_max != null) {
    validated.price_max = Number(filters.price_max);
  }
  if (filters.food_pairing) {
    validated.food_pairing = String(filters.food_pairing).toLowerCase();
  }
  if (filters.occasion) {
    validated.occasion = String(filters.occasion).toLowerCase();
  }
  if (filters.flavor_profile && Array.isArray(filters.flavor_profile)) {
    validated.flavor_profile = normalizeStringArray(filters.flavor_profile);
  }
  if (filters.style_tags) {
    const normalizedStyleTags = normalizeStringArray(filters.style_tags).map((tag) => normalizeStyleTag(tag) ?? tag).filter((tag) => !!tag && isValidStyleTag(tag));
    if (normalizedStyleTags.length > 0) {
      validated.style_tags = [...new Set(normalizedStyleTags)];
    }
  }
  return validated;
}
__name(validateWineFilters, "validateWineFilters");
function buildCompactRerankCandidates(wines) {
  return wines.map((wine) => {
    const candidate = {
      id: wine.id,
      name: wine.name,
      brand: wine.brand,
      wine_type: wine.wine_type
    };
    if (wine.varietal) candidate.varietal = wine.varietal;
    if (wine.region) candidate.region = wine.region;
    if (wine.vintage) candidate.vintage = wine.vintage;
    if (wine.body) candidate.body = wine.body;
    if (wine.sweetness) candidate.sweetness = wine.sweetness;
    if (wine.tannin) candidate.tannin = wine.tannin;
    if (wine.price != null) candidate.price = wine.price;
    if (Array.isArray(wine.flavor_profile) && wine.flavor_profile.length > 0) {
      candidate.flavor_profile = wine.flavor_profile;
    }
    if (Array.isArray(wine.style_tags) && wine.style_tags.length > 0) {
      candidate.style_tags = wine.style_tags;
    }
    if (Array.isArray(wine.food_pairings) && wine.food_pairings.length > 0) {
      candidate.food_pairings = wine.food_pairings;
    }
    if (Array.isArray(wine.occasions) && wine.occasions.length > 0) {
      candidate.occasions = wine.occasions;
    }
    if (wine.tasting_notes) {
      const notes = String(wine.tasting_notes).replace(/\s+/g, " ").trim();
      candidate.tasting_notes = notes.length > 200 ? notes.slice(0, 197) + "..." : notes;
    }
    return candidate;
  });
}
__name(buildCompactRerankCandidates, "buildCompactRerankCandidates");
function parseRobustJSON(rawText) {
  if (!rawText || typeof rawText !== "string") {
    return { success: false, error: "Empty or invalid input" };
  }
  let text = rawText.trim();
  if (text.startsWith("```json")) {
    text = text.replace(/^```json\s*/i, "").replace(/\s*```$/g, "");
  } else if (text.startsWith("```")) {
    text = text.replace(/^```\s*/, "").replace(/\s*```$/g, "");
  }
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, "");
  text = text.replace(/<thinking>[\s\S]*?<\/thinking>/gi, "");
  text = text.replace(/<[^>]+>/g, "");
  text = text.trim();
  if (!text || text.length === 0) {
    return { success: false, error: "Empty text after cleaning" };
  }
  let jsonText = text;
  const firstBrace = text.indexOf("{");
  if (firstBrace === -1) {
    return { success: false, error: "No opening brace found" };
  }
  let braceCount = 0;
  let endBrace = -1;
  for (let i = firstBrace; i < text.length; i++) {
    if (text[i] === "{") braceCount++;
    if (text[i] === "}") braceCount--;
    if (braceCount === 0) {
      endBrace = i + 1;
      break;
    }
  }
  if (endBrace === -1 || braceCount > 0) {
    jsonText = text.substring(firstBrace);
    let openBraces = 0;
    let openBrackets = 0;
    let inString = false;
    let escapeNext = false;
    for (let i = 0; i < jsonText.length; i++) {
      const char = jsonText[i];
      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      if (char === "\\") {
        escapeNext = true;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        continue;
      }
      if (!inString) {
        if (char === "{") openBraces++;
        if (char === "}") openBraces--;
        if (char === "[") openBrackets++;
        if (char === "]") openBrackets--;
      }
    }
    jsonText = jsonText.replace(/,(\s*)$/, "$1");
    for (let i = 0; i < openBrackets; i++) jsonText += "]";
    for (let i = 0; i < openBraces; i++) jsonText += "}";
  } else {
    jsonText = text.substring(firstBrace, endBrace);
  }
  try {
    const parsed = JSON.parse(jsonText);
    return { success: true, data: parsed };
  } catch (parseError) {
    try {
      let cleaned = jsonText;
      cleaned = cleaned.replace(/,(\s*[}\]])/g, "$1");
      cleaned = cleaned.replace(/}\s*"([^"]+)":/g, '}, "$1":');
      cleaned = cleaned.replace(/]\s*"([^"]+)":/g, '], "$1":');
      let quoteCount = 0;
      let lastQuoteIndex = -1;
      for (let i = 0; i < cleaned.length; i++) {
        if (cleaned[i] === '"' && (i === 0 || cleaned[i - 1] !== "\\")) {
          quoteCount++;
          lastQuoteIndex = i;
        }
      }
      if (quoteCount % 2 !== 0 && lastQuoteIndex !== -1) {
        const afterQuote = cleaned.substring(lastQuoteIndex + 1);
        const nextSpecial = afterQuote.search(/[,}\]]/);
        if (nextSpecial !== -1) {
          cleaned = cleaned.substring(0, lastQuoteIndex + 1 + nextSpecial) + '"' + cleaned.substring(lastQuoteIndex + 1 + nextSpecial);
        } else {
          cleaned = cleaned + '"';
        }
      }
      cleaned = cleaned.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
      const parsed = JSON.parse(cleaned);
      return { success: true, data: parsed };
    } catch (finalError) {
      try {
        const idsMatch = jsonText.match(/"ranked_ids":\s*\[(.*?)\]/s);
        if (idsMatch) {
          const rankedIds = [...idsMatch[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
          if (rankedIds.length > 0) {
            return {
              success: true,
              data: { ranked_ids: rankedIds, reasoning: "Partial parse - extracted IDs only" }
            };
          }
        }
      } catch {
      }
      const errorMsg = parseError instanceof Error ? parseError.message : String(parseError);
      return { success: false, error: `JSON parse failed: ${errorMsg}` };
    }
  }
}
__name(parseRobustJSON, "parseRobustJSON");

// src/wine-search.ts
function cloneFilters(filters) {
  return {
    ...filters,
    varietal: Array.isArray(filters.varietal) ? [...filters.varietal] : filters.varietal,
    flavor_profile: filters.flavor_profile ? [...filters.flavor_profile] : void 0,
    style_tags: filters.style_tags ? [...filters.style_tags] : void 0
  };
}
__name(cloneFilters, "cloneFilters");
function omitFilters(filters, keys) {
  const nextFilters = cloneFilters(filters);
  for (const key of keys) {
    delete nextFilters[key];
  }
  return nextFilters;
}
__name(omitFilters, "omitFilters");
function buildSignature(filters) {
  const normalized = cloneFilters(filters);
  if (Array.isArray(normalized.varietal)) {
    normalized.varietal = [...normalized.varietal].sort();
  }
  if (normalized.flavor_profile) {
    normalized.flavor_profile = [...normalized.flavor_profile].sort();
  }
  if (normalized.style_tags) {
    normalized.style_tags = [...normalized.style_tags].sort();
  }
  return JSON.stringify(normalized);
}
__name(buildSignature, "buildSignature");
function buildAnchorFilters(filters) {
  const anchors = {};
  if (filters.brand) anchors.brand = filters.brand;
  if (filters.wine_type) anchors.wine_type = filters.wine_type;
  if (filters.varietal) anchors.varietal = filters.varietal;
  if (filters.style_tags && filters.style_tags.length > 0) anchors.style_tags = filters.style_tags;
  if (!anchors.wine_type && !anchors.varietal && !(anchors.style_tags && anchors.style_tags.length > 0)) {
    if (filters.region) anchors.region = filters.region;
  }
  return anchors;
}
__name(buildAnchorFilters, "buildAnchorFilters");
function buildCatalogFallbackFilters(filters) {
  const bestAvailable = {};
  if (filters.brand) {
    bestAvailable.brand = filters.brand;
  }
  if (filters.wine_type) {
    bestAvailable.wine_type = filters.wine_type;
  } else if (filters.varietal) {
    bestAvailable.varietal = filters.varietal;
  } else if (filters.style_tags && filters.style_tags.length > 0) {
    bestAvailable.style_tags = filters.style_tags;
  }
  return bestAvailable;
}
__name(buildCatalogFallbackFilters, "buildCatalogFallbackFilters");
function pushScalarFilter(conditions, params, column, value) {
  if (Array.isArray(value)) {
    const normalizedValues = value.map((entry) => entry.toLowerCase().trim()).filter((entry) => entry.length > 0);
    if (normalizedValues.length === 0) return;
    const placeholders = normalizedValues.map(() => "?").join(", ");
    conditions.push(`${column} IN (${placeholders})`);
    params.push(...normalizedValues);
    return;
  }
  const normalizedValue = value.toLowerCase().trim();
  if (!normalizedValue) return;
  conditions.push(`${column} = ?`);
  params.push(normalizedValue);
}
__name(pushScalarFilter, "pushScalarFilter");
function pushJsonArrayLikeFilter(conditions, params, column, values) {
  const normalizedValues = values.map((entry) => entry.toLowerCase().trim()).filter((entry) => entry.length > 0);
  if (normalizedValues.length === 0) return;
  const likeConditions = normalizedValues.map(() => `LOWER(${column}) LIKE ?`);
  conditions.push(`(${likeConditions.join(" OR ")})`);
  for (const tag of normalizedValues) {
    params.push(`%"${tag}"%`);
  }
}
__name(pushJsonArrayLikeFilter, "pushJsonArrayLikeFilter");
async function searchWines(db, filters, limit = 10) {
  const conditions = ["in_stock = 1"];
  const params = [];
  if (filters.wine_type) {
    pushScalarFilter(conditions, params, "wine_type", filters.wine_type);
  }
  if (filters.varietal) {
    pushScalarFilter(conditions, params, "varietal", filters.varietal);
  }
  if (filters.region) {
    pushScalarFilter(conditions, params, "region", filters.region);
  }
  if (filters.body) {
    pushScalarFilter(conditions, params, "body", filters.body);
  }
  if (filters.sweetness) {
    pushScalarFilter(conditions, params, "sweetness", filters.sweetness);
  }
  if (filters.acidity) {
    pushScalarFilter(conditions, params, "acidity", filters.acidity);
  }
  if (filters.tannin) {
    pushScalarFilter(conditions, params, "tannin", filters.tannin);
  }
  if (filters.brand) {
    conditions.push("brand = ?");
    params.push(filters.brand);
  }
  if (filters.price_min != null) {
    conditions.push("price >= ?");
    params.push(filters.price_min);
  }
  if (filters.price_max != null) {
    conditions.push("price <= ?");
    params.push(filters.price_max);
  }
  if (filters.food_pairing) {
    conditions.push("LOWER(food_pairings) LIKE ?");
    params.push(`%${filters.food_pairing.toLowerCase()}%`);
  }
  if (filters.occasion) {
    conditions.push("LOWER(occasions) LIKE ?");
    params.push(`%${filters.occasion.toLowerCase()}%`);
  }
  if (filters.flavor_profile && filters.flavor_profile.length > 0) {
    pushJsonArrayLikeFilter(conditions, params, "flavor_profile", filters.flavor_profile);
  }
  if (filters.style_tags && filters.style_tags.length > 0) {
    pushJsonArrayLikeFilter(conditions, params, "style_tags", filters.style_tags);
  }
  const whereClause = conditions.join(" AND ");
  const sql = `SELECT * FROM wines WHERE ${whereClause} ORDER BY staff_pick DESC, price ASC LIMIT ?`;
  params.push(limit);
  try {
    const result = await db.prepare(sql).bind(...params).all();
    return (result.results || []).map(parseWineRow);
  } catch (error) {
    if (filters.style_tags && String(error).toLowerCase().includes("style_tags")) {
      const withoutStyleTags = cloneFilters(filters);
      delete withoutStyleTags.style_tags;
      return searchWines(db, withoutStyleTags, limit);
    }
    throw error;
  }
}
__name(searchWines, "searchWines");
async function searchWinesWithFallback(db, filters, limit = 10) {
  const exactFilters = cloneFilters(filters);
  const withoutFlavor = omitFilters(exactFilters, ["flavor_profile"]);
  const withoutFlavorTexture = omitFilters(withoutFlavor, ["body", "sweetness"]);
  const withoutPreferenceLayer = omitFilters(withoutFlavorTexture, ["occasion", "food_pairing"]);
  const withoutSoftConstraints = omitFilters(withoutPreferenceLayer, ["price_min", "price_max", "region"]);
  const anchorOnly = buildAnchorFilters(exactFilters);
  const bestAvailable = buildCatalogFallbackFilters(exactFilters);
  const plans = [
    { label: "exact_match", filters: exactFilters },
    { label: "broadened_without_flavor", filters: withoutFlavor },
    { label: "broadened_without_flavor_body_sweetness", filters: withoutFlavorTexture },
    { label: "broadened_without_flavor_body_sweetness_pairing", filters: withoutPreferenceLayer },
    { label: "broadened_core_signals", filters: withoutSoftConstraints },
    { label: "catalog_best_available", filters: Object.keys(anchorOnly).length > 0 ? anchorOnly : bestAvailable },
    { label: "catalog_any_available", filters: bestAvailable }
  ];
  const seen = /* @__PURE__ */ new Set();
  for (const plan of plans) {
    const signature = buildSignature(plan.filters);
    if (seen.has(signature)) continue;
    seen.add(signature);
    const results = await searchWines(db, plan.filters, limit);
    if (results.length > 0) {
      return {
        results,
        fallbackReason: plan.label,
        appliedFilters: plan.filters
      };
    }
  }
  const finalResults = await searchWines(db, {}, limit);
  return {
    results: finalResults,
    fallbackReason: finalResults.length > 0 ? "catalog_unfiltered_last_resort" : "no_valid_catalog_results",
    appliedFilters: finalResults.length > 0 ? {} : exactFilters
  };
}
__name(searchWinesWithFallback, "searchWinesWithFallback");
async function lookupWineByName(db, query, limit = 3) {
  const sql = `SELECT * FROM wines WHERE in_stock = 1 AND name LIKE ? ORDER BY staff_pick DESC LIMIT ?`;
  const result = await db.prepare(sql).bind(`%${query}%`, limit).all();
  return (result.results || []).map(parseWineRow);
}
__name(lookupWineByName, "lookupWineByName");
async function surpriseMe(db, filters = {}, limit = 3) {
  const conditions = ["in_stock = 1"];
  const params = [];
  if (filters.wine_type) {
    pushScalarFilter(conditions, params, "wine_type", filters.wine_type);
  }
  if (filters.varietal) {
    pushScalarFilter(conditions, params, "varietal", filters.varietal);
  }
  if (filters.body) {
    pushScalarFilter(conditions, params, "body", filters.body);
  }
  if (filters.sweetness) {
    pushScalarFilter(conditions, params, "sweetness", filters.sweetness);
  }
  if (filters.price_max != null) {
    conditions.push("price <= ?");
    params.push(filters.price_max);
  }
  if (filters.brand) {
    conditions.push("brand = ?");
    params.push(filters.brand);
  }
  if (filters.style_tags && filters.style_tags.length > 0) {
    pushJsonArrayLikeFilter(conditions, params, "style_tags", filters.style_tags);
  }
  const whereClause = conditions.join(" AND ");
  const sql = `SELECT * FROM wines WHERE ${whereClause} ORDER BY RANDOM() LIMIT ?`;
  params.push(limit);
  try {
    const result = await db.prepare(sql).bind(...params).all();
    return (result.results || []).map(parseWineRow);
  } catch (error) {
    if (filters.style_tags && String(error).toLowerCase().includes("style_tags")) {
      const withoutStyleTags = { ...filters };
      delete withoutStyleTags.style_tags;
      return surpriseMe(db, withoutStyleTags, limit);
    }
    throw error;
  }
}
__name(surpriseMe, "surpriseMe");
async function getCatalogFacets(db, filters = {}) {
  const conditions = ["in_stock = 1"];
  const params = [];
  if (filters.brand) {
    conditions.push("brand = ?");
    params.push(filters.brand);
  }
  const sql = `
    SELECT wine_type, varietal, style_tags
    FROM wines
    WHERE ${conditions.join(" AND ")}
  `;
  let rows = [];
  try {
    const result = await db.prepare(sql).bind(...params).all();
    rows = result.results || [];
  } catch (error) {
    if (!String(error).toLowerCase().includes("style_tags")) {
      throw error;
    }
    const fallbackSql = `
      SELECT wine_type, varietal
      FROM wines
      WHERE ${conditions.join(" AND ")}
    `;
    const result = await db.prepare(fallbackSql).bind(...params).all();
    rows = result.results || [];
  }
  const wineTypes = /* @__PURE__ */ new Set();
  const varietalsByWineType = /* @__PURE__ */ new Map();
  const styleTagsByWineType = /* @__PURE__ */ new Map();
  for (const row of rows) {
    const wineType = String(row.wine_type || "").toLowerCase().trim();
    if (!wineType) continue;
    wineTypes.add(wineType);
    const varietal = String(row.varietal || "").toLowerCase().trim();
    if (varietal) {
      if (!varietalsByWineType.has(wineType)) {
        varietalsByWineType.set(wineType, /* @__PURE__ */ new Set());
      }
      varietalsByWineType.get(wineType).add(varietal);
    }
    const styleTags = safeParseJsonArray(row.style_tags);
    if (styleTags.length > 0) {
      if (!styleTagsByWineType.has(wineType)) {
        styleTagsByWineType.set(wineType, /* @__PURE__ */ new Set());
      }
      for (const styleTag of styleTags) {
        styleTagsByWineType.get(wineType).add(styleTag);
      }
    }
  }
  return {
    wineTypes: [...wineTypes].sort(),
    varietalsByWineType: Object.fromEntries(
      [...varietalsByWineType.entries()].map(([wineType, varietals]) => [
        wineType,
        [...varietals].sort()
      ])
    ),
    styleTagsByWineType: Object.fromEntries(
      [...styleTagsByWineType.entries()].map(([wineType, styleTags]) => [
        wineType,
        [...styleTags].sort()
      ])
    )
  };
}
__name(getCatalogFacets, "getCatalogFacets");
function parseWineRow(row) {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    wine_type: row.wine_type,
    varietal: row.varietal || null,
    region: row.region || null,
    vintage: row.vintage || null,
    body: row.body || null,
    sweetness: row.sweetness || null,
    acidity: row.acidity || null,
    tannin: row.tannin || null,
    alcohol_pct: row.alcohol_pct || null,
    price: row.price || null,
    description: row.description || null,
    tasting_notes: row.tasting_notes || null,
    flavor_profile: safeParseJsonArray(row.flavor_profile),
    style_tags: safeParseJsonArray(row.style_tags),
    food_pairings: safeParseJsonArray(row.food_pairings),
    occasions: safeParseJsonArray(row.occasions),
    image_url: row.image_url || null,
    shop_link: row.shop_link || null,
    source_name: row.source_name || null,
    source_kind: row.source_kind || null,
    source_url: row.source_url || null,
    last_scraped_at: row.last_scraped_at || null,
    in_stock: row.in_stock === 1,
    staff_pick: row.staff_pick === 1
  };
}
__name(parseWineRow, "parseWineRow");
function safeParseJsonArray(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map((entry) => String(entry).toLowerCase().trim()).filter((entry) => entry.length > 0) : [];
  } catch {
    return [];
  }
}
__name(safeParseJsonArray, "safeParseJsonArray");

// src/chat-analytics.ts
var SEARCH_SEQUENCE_TIMEOUT_MS = 10 * 60 * 1e3;
var SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS chat_sessions (
  session_id TEXT PRIMARY KEY,
  store_id TEXT,
  source_page TEXT,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  message_count INTEGER NOT NULL DEFAULT 0,
  sequence_count INTEGER NOT NULL DEFAULT 0,
  last_activity_at TEXT NOT NULL,
  browser_token TEXT,
  predecessor_session_id TEXT,
  age_gate_required INTEGER NOT NULL DEFAULT 0,
  age_gate_rendered_at TEXT,
  age_confirmed_at TEXT,
  age_declined_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_users (
  browser_token TEXT PRIMARY KEY,
  email TEXT,
  name TEXT,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_search_sequences (
  search_sequence_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  first_message_id TEXT,
  last_message_id TEXT,
  message_count INTEGER NOT NULL DEFAULT 0,
  resolved_query_text TEXT,
  resolved_query_normalized TEXT,
  resolved_bucket_label TEXT,
  resolved_product_id TEXT,
  cue_verdict TEXT NOT NULL DEFAULT 'unknown',
  intent_verdict TEXT NOT NULL DEFAULT 'unknown',
  recommendation_verdict TEXT NOT NULL DEFAULT 'unknown',
  satisfaction_verdict TEXT NOT NULL DEFAULT 'open',
  reason_codes_json TEXT,
  source TEXT NOT NULL DEFAULT 'chat',
  guided_flow_filters TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_messages (
  message_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  search_sequence_id TEXT NOT NULL,
  message_index INTEGER NOT NULL,
  user_text_raw TEXT,
  user_text_normalized TEXT,
  assistant_response_text TEXT,
  predicted_cue TEXT,
  predicted_intent TEXT,
  predicted_filters_json TEXT,
  semantic_search TEXT,
  product_query TEXT,
  result_count INTEGER,
  pre_rank_count INTEGER,
  final_rank_count INTEGER,
  latency_ms INTEGER,
  status TEXT,
  error_code TEXT,
  fallback_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_message_products (
  message_product_id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  search_sequence_id TEXT NOT NULL,
  product_id TEXT,
  product_name TEXT,
  brand TEXT,
  category TEXT,
  subcategory TEXT,
  rank_position INTEGER,
  source_kind TEXT,
  shown_at TEXT NOT NULL,
  clicked_at TEXT,
  external_clicked_at TEXT
);

CREATE TABLE IF NOT EXISTS chat_events (
  event_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  message_id TEXT,
  search_sequence_id TEXT,
  event_type TEXT NOT NULL,
  product_id TEXT,
  rank_position INTEGER,
  payload_json TEXT,
  occurred_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_last_activity_at
  ON chat_sessions(last_activity_at);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_browser_token
  ON chat_sessions(browser_token);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_predecessor_session_id
  ON chat_sessions(predecessor_session_id);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_age_gate_rendered_at
  ON chat_sessions(age_gate_rendered_at);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_age_confirmed_at
  ON chat_sessions(age_confirmed_at);

CREATE INDEX IF NOT EXISTS idx_chat_sequences_source
  ON chat_search_sequences(source);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id
  ON chat_messages(session_id);

CREATE INDEX IF NOT EXISTS idx_chat_messages_sequence_id
  ON chat_messages(search_sequence_id);

CREATE INDEX IF NOT EXISTS idx_chat_messages_user_text_normalized
  ON chat_messages(user_text_normalized);

CREATE INDEX IF NOT EXISTS idx_chat_sequences_session_id
  ON chat_search_sequences(session_id);

CREATE INDEX IF NOT EXISTS idx_chat_sequences_status
  ON chat_search_sequences(status);

CREATE INDEX IF NOT EXISTS idx_chat_message_products_message_id
  ON chat_message_products(message_id);

CREATE INDEX IF NOT EXISTS idx_chat_message_products_product_id
  ON chat_message_products(product_id);

CREATE INDEX IF NOT EXISTS idx_chat_events_session_id
  ON chat_events(session_id);

CREATE INDEX IF NOT EXISTS idx_chat_events_message_id
  ON chat_events(message_id);

CREATE INDEX IF NOT EXISTS idx_chat_events_type
  ON chat_events(event_type);

CREATE INDEX IF NOT EXISTS idx_chat_events_occurred_at
  ON chat_events(occurred_at);

CREATE TABLE IF NOT EXISTS chat_leads (
  lead_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  email TEXT NOT NULL,
  name TEXT,
  intent_signal TEXT,
  profile_type TEXT,
  taste_preferences_json TEXT,
  source_page TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_leads_email
  ON chat_leads(email);

CREATE INDEX IF NOT EXISTS idx_chat_leads_session_id
  ON chat_leads(session_id);
`;
var schemaByDb = /* @__PURE__ */ new WeakMap();
function nowIso() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
__name(nowIso, "nowIso");
function toTimestamp(value) {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}
__name(toTimestamp, "toTimestamp");
function safeString(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
__name(safeString, "safeString");
function toJson(value) {
  if (value === void 0 || value === null) return null;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}
__name(toJson, "toJson");
function parseReasonCodes(raw2) {
  if (!raw2) return [];
  try {
    const parsed = JSON.parse(raw2);
    return Array.isArray(parsed) ? parsed.map((value) => String(value)).filter(Boolean) : [];
  } catch {
    return [];
  }
}
__name(parseReasonCodes, "parseReasonCodes");
function mergeReasonCodes(currentRaw, ...values) {
  const merged = new Set(parseReasonCodes(currentRaw));
  for (const value of values) {
    if (value) merged.add(value);
  }
  return JSON.stringify(Array.from(merged));
}
__name(mergeReasonCodes, "mergeReasonCodes");
function normalizeQueryText(raw2) {
  const base = safeString(raw2);
  if (!base) return null;
  return base.toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/[^a-z0-9$%+\-./\s]/g, " ").replace(/\s+/g, " ").trim();
}
__name(normalizeQueryText, "normalizeQueryText");
function cleanAssistantResponseText(raw2) {
  const base = safeString(raw2);
  if (!base) return null;
  let cleaned = base;
  const productContextIndex = cleaned.indexOf("**PRODUCT CONTEXT**");
  if (productContextIndex !== -1) {
    cleaned = cleaned.slice(0, productContextIndex).trim();
  }
  cleaned = cleaned.replace(/```\s*\{[\s\S]*?\}\s*```/g, "").trim();
  cleaned = cleaned.replace(/```/g, "").trim();
  return cleaned || null;
}
__name(cleanAssistantResponseText, "cleanAssistantResponseText");
function mergeAssistantResponseText(existing, incoming) {
  const current = cleanAssistantResponseText(existing);
  const next = cleanAssistantResponseText(incoming);
  if (!next) return current;
  if (!current) return next;
  if (current === next || current.includes(next)) return current;
  if (next.includes(current)) return next;
  return `${current}

${next}`;
}
__name(mergeAssistantResponseText, "mergeAssistantResponseText");
function detectPredictedCue(text) {
  const content = text ?? "";
  if (content.includes("I completely understand what you're looking for") || content.includes("Let me check what we have that matches your preferences") || content.includes("I'm pulling up wines that fit your criteria") || content.includes("Checking our selection based on what you described")) {
    return "RECOMMEND";
  }
  if (content.includes("Let me look up") || content.includes("Let me check on") || content.includes("Let me pull up") || content.includes("I'll pull up the details") || content.includes("Getting more details on")) {
    return "PRODUCT_LOOKUP";
  }
  return null;
}
__name(detectPredictedCue, "detectPredictedCue");
function inferBucketLabel(params) {
  const predictedIntent = safeString(params.predictedIntent)?.toLowerCase();
  if (predictedIntent === "recommendation" || predictedIntent === "product-question") {
    return "Product search";
  }
  const haystack = [
    params.userTextRaw,
    params.semanticSearch,
    params.productQuery
  ].filter(Boolean).join(" ").toLowerCase();
  if (!haystack) return null;
  if (/\b(price|deal|deals|sale|sales|cheap|under \$|cost)\b/.test(haystack)) {
    return "Deals & pricing";
  }
  if (/\b(hours|open|close|delivery|deliver|pickup|location|address)\b/.test(haystack)) {
    return "Store info";
  }
  if (/\b(loyalty|points|account|login|return|refund|job|apply)\b/.test(haystack)) {
    return "Account";
  }
  if (/\b(what is|what are|difference|terpene|terpenes|cannabinoid|cannabinoids|thc|cbd|rs o|rso)\b/.test(haystack)) {
    return "Education";
  }
  return null;
}
__name(inferBucketLabel, "inferBucketLabel");
var MIGRATION_SQL = `
ALTER TABLE chat_sessions ADD COLUMN browser_token TEXT;
ALTER TABLE chat_sessions ADD COLUMN predecessor_session_id TEXT;
ALTER TABLE chat_sessions ADD COLUMN age_gate_required INTEGER NOT NULL DEFAULT 0;
ALTER TABLE chat_sessions ADD COLUMN age_gate_rendered_at TEXT;
ALTER TABLE chat_sessions ADD COLUMN age_confirmed_at TEXT;
ALTER TABLE chat_sessions ADD COLUMN age_declined_at TEXT;
ALTER TABLE chat_search_sequences ADD COLUMN source TEXT NOT NULL DEFAULT 'chat';
ALTER TABLE chat_search_sequences ADD COLUMN guided_flow_filters TEXT;
`;
async function ensureSchema(db) {
  const existing = schemaByDb.get(db);
  if (existing) {
    await existing;
    return;
  }
  const initPromise = (async () => {
    const statements = SCHEMA_SQL.split(";").map((statement) => statement.trim()).filter(Boolean).map((statement) => statement.replace(/\s+/g, " "));
    for (const statement of statements) {
      try {
        await db.exec(statement);
      } catch (error) {
        throw new Error(
          `Schema statement failed: ${statement}. Original error: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
    const migrations = MIGRATION_SQL.split(";").map((s) => s.trim()).filter(Boolean);
    for (const migration of migrations) {
      try {
        await db.exec(migration);
      } catch {
      }
    }
  })().catch((error) => {
    schemaByDb.delete(db);
    throw error;
  });
  schemaByDb.set(db, initPromise);
  await initPromise;
}
__name(ensureSchema, "ensureSchema");
async function getMessageRecord(db, messageId) {
  const record = await db.prepare(
    `SELECT
        message_id,
        session_id,
        search_sequence_id,
        message_index,
        user_text_raw,
        user_text_normalized,
        assistant_response_text,
        predicted_cue,
        predicted_intent,
        semantic_search,
        product_query,
        updated_at
      FROM chat_messages
      WHERE message_id = ?`
  ).bind(messageId).first();
  return record ?? null;
}
__name(getMessageRecord, "getMessageRecord");
async function getSequenceRecord(db, searchSequenceId) {
  const record = await db.prepare(
    `SELECT
        search_sequence_id,
        session_id,
        status,
        updated_at,
        reason_codes_json
      FROM chat_search_sequences
      WHERE search_sequence_id = ?`
  ).bind(searchSequenceId).first();
  return record ?? null;
}
__name(getSequenceRecord, "getSequenceRecord");
async function ensureSession(db, analytics, currentIso) {
  const sessionId = safeString(analytics.sessionId);
  if (!sessionId) return;
  const existing = await db.prepare(
    `SELECT started_at
       FROM chat_sessions
       WHERE session_id = ?`
  ).bind(sessionId).first();
  if (!existing) {
    await db.prepare(
      `INSERT INTO chat_sessions (
          session_id,
          store_id,
          source_page,
          started_at,
          ended_at,
          message_count,
          sequence_count,
          last_activity_at,
          browser_token,
          predecessor_session_id,
          age_gate_required,
          age_gate_rendered_at,
          age_confirmed_at,
          age_declined_at,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, NULL, 0, 0, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?)`
    ).bind(
      sessionId,
      safeString(analytics.storeId),
      safeString(analytics.sourcePage),
      currentIso,
      currentIso,
      safeString(analytics.browserToken),
      safeString(analytics.predecessorSessionId),
      analytics.ageGateRequired ? 1 : 0,
      currentIso,
      currentIso
    ).run();
    return;
  }
  await db.prepare(
    `UPDATE chat_sessions
       SET store_id = COALESCE(?, store_id),
           source_page = COALESCE(?, source_page),
           browser_token = COALESCE(?, browser_token),
           predecessor_session_id = COALESCE(?, predecessor_session_id),
           ended_at = NULL,
           last_activity_at = ?,
           updated_at = ?
       WHERE session_id = ?`
  ).bind(
    safeString(analytics.storeId),
    safeString(analytics.sourcePage),
    safeString(analytics.browserToken),
    safeString(analytics.predecessorSessionId),
    currentIso,
    currentIso,
    sessionId
  ).run();
  const bt = safeString(analytics.browserToken);
  if (bt) {
    await ensureUser(db, bt, currentIso);
  }
}
__name(ensureSession, "ensureSession");
async function createSearchSequence(db, sessionId, messageId, currentIso, userTextRaw, predictedIntent) {
  const searchSequenceId = crypto.randomUUID();
  const normalized = normalizeQueryText(userTextRaw);
  const bucket = inferBucketLabel({
    predictedIntent,
    userTextRaw
  });
  await db.prepare(
    `INSERT INTO chat_search_sequences (
        search_sequence_id,
        session_id,
        started_at,
        ended_at,
        status,
        first_message_id,
        last_message_id,
        message_count,
        resolved_query_text,
        resolved_query_normalized,
        resolved_bucket_label,
        resolved_product_id,
        cue_verdict,
        intent_verdict,
        recommendation_verdict,
        satisfaction_verdict,
        reason_codes_json,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, NULL, 'open', ?, ?, 0, ?, ?, ?, NULL, 'unknown', 'unknown', 'unknown', 'open', '[]', ?, ?)`
  ).bind(
    searchSequenceId,
    sessionId,
    currentIso,
    messageId,
    messageId,
    userTextRaw,
    normalized,
    bucket,
    currentIso,
    currentIso
  ).run();
  await db.prepare(
    `UPDATE chat_sessions
       SET sequence_count = sequence_count + 1,
           updated_at = ?
       WHERE session_id = ?`
  ).bind(currentIso, sessionId).run();
  return searchSequenceId;
}
__name(createSearchSequence, "createSearchSequence");
async function finalizeSequenceAsUnresolved(db, searchSequenceId, currentIso, reasonCode) {
  const sequence = await getSequenceRecord(db, searchSequenceId);
  if (!sequence || sequence.status === "resolved") return;
  const messageStats = await db.prepare(
    `SELECT
        MAX(COALESCE(result_count, 0)) AS max_result_count,
        SUM(CASE WHEN COALESCE(result_count, 0) = 0 THEN 1 ELSE 0 END) AS zero_result_messages,
        SUM(CASE WHEN fallback_reason IS NOT NULL THEN 1 ELSE 0 END) AS fallback_messages,
        SUM(CASE WHEN error_code IS NOT NULL THEN 1 ELSE 0 END) AS error_messages
      FROM chat_messages
      WHERE search_sequence_id = ?`
  ).bind(searchSequenceId).first();
  const clickStats = await db.prepare(
    `SELECT
        SUM(CASE WHEN external_clicked_at IS NOT NULL THEN 1 ELSE 0 END) AS external_clicks
      FROM chat_message_products
      WHERE search_sequence_id = ?`
  ).bind(searchSequenceId).first();
  const externalClicks = Number(clickStats?.external_clicks ?? 0);
  const maxResultCount = Number(messageStats?.max_result_count ?? 0);
  const zeroResultMessages = Number(messageStats?.zero_result_messages ?? 0);
  const fallbackMessages = Number(messageStats?.fallback_messages ?? 0);
  const errorMessages = Number(messageStats?.error_messages ?? 0);
  let recommendationVerdict = "unknown";
  if (externalClicks > 0) {
    recommendationVerdict = "good";
  } else if (maxResultCount > 0) {
    recommendationVerdict = "weak";
  } else if (zeroResultMessages > 0 || fallbackMessages > 0 || errorMessages > 0) {
    recommendationVerdict = "miss";
  }
  const reasonCodesJson = mergeReasonCodes(
    sequence.reason_codes_json,
    reasonCode,
    zeroResultMessages > 0 ? "no_results" : null,
    fallbackMessages > 0 ? "fallback" : null,
    errorMessages > 0 ? "error" : null
  );
  await db.prepare(
    `UPDATE chat_search_sequences
       SET status = 'unresolved',
           ended_at = COALESCE(ended_at, ?),
           recommendation_verdict = CASE
             WHEN recommendation_verdict = 'unknown' THEN ?
             ELSE recommendation_verdict
           END,
           satisfaction_verdict = CASE
             WHEN satisfaction_verdict = 'open' THEN 'unresolved'
             ELSE satisfaction_verdict
           END,
           reason_codes_json = ?,
           updated_at = ?
       WHERE search_sequence_id = ?`
  ).bind(currentIso, recommendationVerdict, reasonCodesJson, currentIso, searchSequenceId).run();
}
__name(finalizeSequenceAsUnresolved, "finalizeSequenceAsUnresolved");
async function getOrCreateSearchSequence(db, analytics, messageId, currentIso, userTextRaw, predictedIntent) {
  const sessionId = safeString(analytics.sessionId);
  if (!sessionId) {
    throw new Error("session_id is required to create a search sequence");
  }
  const latest = await db.prepare(
    `SELECT
        search_sequence_id,
        status,
        updated_at
      FROM chat_search_sequences
      WHERE session_id = ?
      ORDER BY started_at DESC
      LIMIT 1`
  ).bind(sessionId).first();
  if (!latest) {
    return createSearchSequence(db, sessionId, messageId, currentIso, userTextRaw, predictedIntent);
  }
  const latestUpdatedAt = toTimestamp(latest.updated_at);
  const isExpired = latestUpdatedAt === null || Date.now() - latestUpdatedAt > SEARCH_SEQUENCE_TIMEOUT_MS;
  if (latest.status === "resolved") {
    return createSearchSequence(db, sessionId, messageId, currentIso, userTextRaw, predictedIntent);
  }
  if (isExpired) {
    await finalizeSequenceAsUnresolved(db, latest.search_sequence_id, currentIso, "sequence_timeout");
    return createSearchSequence(db, sessionId, messageId, currentIso, userTextRaw, predictedIntent);
  }
  return latest.search_sequence_id;
}
__name(getOrCreateSearchSequence, "getOrCreateSearchSequence");
async function touchSearchSequence(db, searchSequenceId, currentIso) {
  await db.prepare(
    `UPDATE chat_search_sequences
       SET updated_at = ?
       WHERE search_sequence_id = ?`
  ).bind(currentIso, searchSequenceId).run();
}
__name(touchSearchSequence, "touchSearchSequence");
async function ensureMessageRecord(db, analytics, userTextRaw) {
  const sessionId = safeString(analytics.sessionId);
  const messageId = safeString(analytics.messageId);
  if (!sessionId || !messageId) return null;
  const currentIso = nowIso();
  await ensureSchema(db);
  await ensureSession(db, analytics, currentIso);
  const existing = await getMessageRecord(db, messageId);
  if (existing) {
    await touchSearchSequence(db, existing.search_sequence_id, currentIso);
    return {
      messageId: existing.message_id,
      sessionId: existing.session_id,
      searchSequenceId: existing.search_sequence_id
    };
  }
  const normalizedUserText = normalizeQueryText(userTextRaw);
  const searchSequenceId = await getOrCreateSearchSequence(
    db,
    analytics,
    messageId,
    currentIso,
    userTextRaw ?? null
  );
  const nextIndexRow = await db.prepare(
    `SELECT COALESCE(MAX(message_index), 0) + 1 AS next_index
       FROM chat_messages
       WHERE session_id = ?`
  ).bind(sessionId).first();
  const messageIndex = Number(nextIndexRow?.next_index ?? 1);
  await db.prepare(
    `INSERT INTO chat_messages (
        message_id,
        session_id,
        search_sequence_id,
        message_index,
        user_text_raw,
        user_text_normalized,
        assistant_response_text,
        predicted_cue,
        predicted_intent,
        predicted_filters_json,
        semantic_search,
        product_query,
        result_count,
        pre_rank_count,
        final_rank_count,
        latency_ms,
        status,
        error_code,
        fallback_reason,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'open', NULL, NULL, ?, ?)`
  ).bind(
    messageId,
    sessionId,
    searchSequenceId,
    messageIndex,
    userTextRaw ?? null,
    normalizedUserText,
    currentIso,
    currentIso
  ).run();
  await db.prepare(
    `UPDATE chat_sessions
       SET message_count = message_count + 1,
           last_activity_at = ?,
           updated_at = ?
       WHERE session_id = ?`
  ).bind(currentIso, currentIso, sessionId).run();
  await db.prepare(
    `UPDATE chat_search_sequences
       SET last_message_id = ?,
           message_count = message_count + 1,
           resolved_query_text = COALESCE(?, resolved_query_text),
           resolved_query_normalized = COALESCE(?, resolved_query_normalized),
           updated_at = ?
       WHERE search_sequence_id = ?`
  ).bind(
    messageId,
    userTextRaw ?? null,
    normalizedUserText,
    currentIso,
    searchSequenceId
  ).run();
  return { messageId, sessionId, searchSequenceId };
}
__name(ensureMessageRecord, "ensureMessageRecord");
async function refreshSequenceSummary(db, searchSequenceId, messageId, currentIso) {
  const latest = await db.prepare(
    `SELECT
        user_text_raw,
        user_text_normalized,
        predicted_intent,
        semantic_search,
        product_query
      FROM chat_messages
      WHERE message_id = ?`
  ).bind(messageId).first();
  const bucketLabel = inferBucketLabel({
    predictedIntent: latest?.predicted_intent ?? null,
    userTextRaw: latest?.user_text_raw ?? null,
    semanticSearch: latest?.semantic_search ?? null,
    productQuery: latest?.product_query ?? null
  });
  await db.prepare(
    `UPDATE chat_search_sequences
       SET last_message_id = ?,
           resolved_query_text = COALESCE(?, resolved_query_text),
           resolved_query_normalized = COALESCE(?, resolved_query_normalized),
           resolved_bucket_label = COALESCE(?, resolved_bucket_label),
           updated_at = ?
       WHERE search_sequence_id = ?`
  ).bind(
    messageId,
    latest?.user_text_raw ?? null,
    latest?.user_text_normalized ?? null,
    bucketLabel,
    currentIso,
    searchSequenceId
  ).run();
}
__name(refreshSequenceSummary, "refreshSequenceSummary");
async function upsertShownProducts(db, ids, products, shownAtIso) {
  for (const [index, product] of products.entries()) {
    const rankPosition = Number(product.rankPosition ?? index + 1);
    const productId = safeString(product.id);
    const messageProductId = `${ids.messageId}:${safeString(product.sourceKind) ?? "shown"}:${productId ?? `rank-${rankPosition}`}`;
    await db.prepare(
      `INSERT OR REPLACE INTO chat_message_products (
          message_product_id,
          message_id,
          session_id,
          search_sequence_id,
          product_id,
          product_name,
          brand,
          category,
          subcategory,
          rank_position,
          source_kind,
          shown_at,
          clicked_at,
          external_clicked_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(
          (SELECT clicked_at FROM chat_message_products WHERE message_product_id = ?),
          NULL
        ), COALESCE(
          (SELECT external_clicked_at FROM chat_message_products WHERE message_product_id = ?),
          NULL
        ))`
    ).bind(
      messageProductId,
      ids.messageId,
      ids.sessionId,
      ids.searchSequenceId,
      productId,
      safeString(product.name),
      safeString(product.brand),
      safeString(product.category),
      safeString(product.subcategory),
      rankPosition,
      safeString(product.sourceKind) ?? "shown",
      shownAtIso,
      messageProductId,
      messageProductId
    ).run();
  }
}
__name(upsertShownProducts, "upsertShownProducts");
async function markSequenceResolved(db, searchSequenceId, currentIso, productId) {
  await db.prepare(
    `UPDATE chat_search_sequences
       SET status = 'resolved',
           ended_at = COALESCE(ended_at, ?),
           resolved_product_id = COALESCE(?, resolved_product_id),
           recommendation_verdict = CASE
             WHEN recommendation_verdict = 'unknown' THEN 'good'
             ELSE recommendation_verdict
           END,
           satisfaction_verdict = 'resolved',
           updated_at = ?
       WHERE search_sequence_id = ?`
  ).bind(currentIso, safeString(productId), currentIso, searchSequenceId).run();
}
__name(markSequenceResolved, "markSequenceResolved");
async function recordStreamCompletion(db, input) {
  const userTextRaw = safeString(input.userTextRaw);
  const ids = await ensureMessageRecord(db, input.analytics, userTextRaw);
  if (!ids) return;
  const currentIso = nowIso();
  const existing = await getMessageRecord(db, ids.messageId);
  const cleanedText = cleanAssistantResponseText(input.assistantResponseText);
  const mergedText = mergeAssistantResponseText(existing?.assistant_response_text, cleanedText);
  const detectedCue = detectPredictedCue(cleanedText);
  await db.prepare(
    `UPDATE chat_messages
       SET assistant_response_text = ?,
           predicted_cue = COALESCE(?, predicted_cue),
           latency_ms = COALESCE(?, latency_ms),
           status = COALESCE(?, status),
           error_code = COALESCE(?, error_code),
           updated_at = ?
       WHERE message_id = ?`
  ).bind(
    mergedText,
    detectedCue,
    input.latencyMs ?? null,
    safeString(input.status),
    safeString(input.errorCode),
    currentIso,
    ids.messageId
  ).run();
  await refreshSequenceSummary(db, ids.searchSequenceId, ids.messageId, currentIso);
}
__name(recordStreamCompletion, "recordStreamCompletion");
async function recordIntentAnalysis(db, input) {
  const userTextRaw = safeString(input.userTextRaw);
  const ids = await ensureMessageRecord(db, input.analytics, userTextRaw);
  if (!ids) return;
  const currentIso = nowIso();
  await db.prepare(
    `UPDATE chat_messages
       SET predicted_cue = COALESCE(?, predicted_cue),
           predicted_intent = COALESCE(?, predicted_intent),
           predicted_filters_json = COALESCE(?, predicted_filters_json),
           semantic_search = COALESCE(?, semantic_search),
           product_query = COALESCE(?, product_query),
           latency_ms = COALESCE(?, latency_ms),
           status = COALESCE(?, status),
           error_code = COALESCE(?, error_code),
           updated_at = ?
       WHERE message_id = ?`
  ).bind(
    safeString(input.predictedCue),
    safeString(input.predictedIntent),
    toJson(input.predictedFilters),
    safeString(input.semanticSearch),
    safeString(input.productQuery),
    input.latencyMs ?? null,
    safeString(input.status),
    safeString(input.errorCode),
    currentIso,
    ids.messageId
  ).run();
  await refreshSequenceSummary(db, ids.searchSequenceId, ids.messageId, currentIso);
}
__name(recordIntentAnalysis, "recordIntentAnalysis");
async function recordRecommendationResults(db, input) {
  const userTextRaw = safeString(input.userTextRaw);
  const ids = await ensureMessageRecord(db, input.analytics, userTextRaw);
  if (!ids) return;
  const currentIso = nowIso();
  const recommendations = input.recommendations ?? [];
  const resultCount = recommendations.length;
  await db.prepare(
    `UPDATE chat_messages
       SET predicted_cue = COALESCE(?, predicted_cue),
           predicted_intent = COALESCE(?, predicted_intent),
           predicted_filters_json = COALESCE(?, predicted_filters_json),
           semantic_search = COALESCE(?, semantic_search),
           result_count = ?,
           pre_rank_count = COALESCE(?, pre_rank_count),
           final_rank_count = COALESCE(?, final_rank_count),
           latency_ms = COALESCE(?, latency_ms),
           status = COALESCE(?, status),
           error_code = COALESCE(?, error_code),
           fallback_reason = COALESCE(?, fallback_reason),
           updated_at = ?
       WHERE message_id = ?`
  ).bind(
    safeString(input.predictedCue),
    safeString(input.predictedIntent),
    toJson(input.predictedFilters),
    safeString(input.semanticSearch),
    resultCount,
    input.preRankedCount ?? null,
    input.finalRankCount ?? resultCount,
    input.latencyMs ?? null,
    safeString(input.status),
    safeString(input.errorCode),
    safeString(input.fallbackReason),
    currentIso,
    ids.messageId
  ).run();
  if (recommendations.length > 0) {
    await upsertShownProducts(db, ids, recommendations, currentIso);
  }
  const existingSequence = await getSequenceRecord(db, ids.searchSequenceId);
  if (resultCount === 0 && existingSequence?.status === "open") {
    await db.prepare(
      `UPDATE chat_search_sequences
         SET reason_codes_json = ?,
             updated_at = ?
         WHERE search_sequence_id = ?`
    ).bind(
      mergeReasonCodes(existingSequence.reason_codes_json, "no_results"),
      currentIso,
      ids.searchSequenceId
    ).run();
  }
  await refreshSequenceSummary(db, ids.searchSequenceId, ids.messageId, currentIso);
}
__name(recordRecommendationResults, "recordRecommendationResults");
async function recordProductLookupResult(db, input) {
  const userTextRaw = safeString(input.userTextRaw);
  const ids = await ensureMessageRecord(db, input.analytics, userTextRaw);
  if (!ids) return;
  const currentIso = nowIso();
  const resolvedProduct = input.product ? [input.product] : [];
  const resultCount = resolvedProduct.length;
  const fallbackReason = input.needsClarification ? "clarification" : safeString(input.fallbackReason);
  await db.prepare(
    `UPDATE chat_messages
       SET predicted_cue = COALESCE(?, predicted_cue),
           predicted_intent = COALESCE(?, predicted_intent),
           product_query = COALESCE(?, product_query),
           result_count = ?,
           final_rank_count = ?,
           latency_ms = COALESCE(?, latency_ms),
           status = COALESCE(?, status),
           fallback_reason = COALESCE(?, fallback_reason),
           updated_at = ?
       WHERE message_id = ?`
  ).bind(
    safeString(input.predictedCue),
    safeString(input.predictedIntent),
    safeString(input.productQuery),
    resultCount,
    resultCount,
    input.latencyMs ?? null,
    safeString(input.status),
    fallbackReason,
    currentIso,
    ids.messageId
  ).run();
  if (resolvedProduct.length > 0) {
    await upsertShownProducts(
      db,
      ids,
      resolvedProduct.map((product, index) => ({
        ...product,
        rankPosition: product.rankPosition ?? index + 1,
        sourceKind: product.sourceKind ?? "product_lookup"
      })),
      currentIso
    );
  } else if (input.needsClarification) {
    const sequence = await getSequenceRecord(db, ids.searchSequenceId);
    if (sequence?.status === "open") {
      await db.prepare(
        `UPDATE chat_search_sequences
           SET reason_codes_json = ?,
               updated_at = ?
           WHERE search_sequence_id = ?`
      ).bind(
        mergeReasonCodes(sequence.reason_codes_json, "clarification"),
        currentIso,
        ids.searchSequenceId
      ).run();
    }
  }
  await refreshSequenceSummary(db, ids.searchSequenceId, ids.messageId, currentIso);
}
__name(recordProductLookupResult, "recordProductLookupResult");
async function recordAnalyticsEvent(db, event) {
  const sessionId = safeString(event.sessionId);
  const eventType = safeString(event.eventType);
  if (!sessionId || !eventType) return;
  await ensureSchema(db);
  const occurredAt = safeString(event.occurredAt) ?? nowIso();
  const messageId = safeString(event.messageId);
  const eventId = safeString(event.eventId) ?? crypto.randomUUID();
  await ensureSession(
    db,
    {
      sessionId,
      messageId,
      sourcePage: null,
      storeId: null
    },
    occurredAt
  );
  let searchSequenceId = null;
  if (messageId) {
    const message = await getMessageRecord(db, messageId);
    searchSequenceId = message?.search_sequence_id ?? null;
  }
  await db.prepare(
    `INSERT OR REPLACE INTO chat_events (
        event_id,
        session_id,
        message_id,
        search_sequence_id,
        event_type,
        product_id,
        rank_position,
        payload_json,
        occurred_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    eventId,
    sessionId,
    messageId,
    searchSequenceId,
    eventType,
    safeString(event.productId),
    event.rankPosition ?? null,
    toJson(event.payload),
    occurredAt
  ).run();
  await db.prepare(
    `UPDATE chat_sessions
       SET last_activity_at = ?,
           updated_at = ?,
           ended_at = CASE
             WHEN ? = 'session_closed' THEN ?
             ELSE ended_at
           END
       WHERE session_id = ?`
  ).bind(occurredAt, occurredAt, eventType, occurredAt, sessionId).run();
  if (messageId && searchSequenceId) {
    await touchSearchSequence(db, searchSequenceId, occurredAt);
  }
  if (eventType === "external_link_clicked" && messageId && searchSequenceId) {
    const productId = safeString(event.productId);
    if (productId) {
      await db.prepare(
        `UPDATE chat_message_products
           SET clicked_at = COALESCE(clicked_at, ?),
               external_clicked_at = COALESCE(external_clicked_at, ?)
           WHERE message_id = ?
             AND product_id = ?`
      ).bind(occurredAt, occurredAt, messageId, productId).run();
    }
    await markSequenceResolved(db, searchSequenceId, occurredAt, productId);
  }
}
__name(recordAnalyticsEvent, "recordAnalyticsEvent");
async function recordLeadCapture(db, input) {
  await ensureSchema(db);
  const leadId = crypto.randomUUID();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  await db.prepare(
    `INSERT INTO chat_leads (lead_id, session_id, email, name, intent_signal, profile_type, taste_preferences_json, source_page, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    leadId,
    input.sessionId,
    input.email,
    input.name ?? null,
    input.intentSignal,
    input.profileType,
    input.tastePreferences ? JSON.stringify(input.tastePreferences) : null,
    input.sourcePage ?? null,
    now
  ).run();
  return leadId;
}
__name(recordLeadCapture, "recordLeadCapture");
async function ensureUser(db, browserToken, currentIso) {
  if (!browserToken) return;
  const existing = await db.prepare(
    `SELECT browser_token FROM chat_users WHERE browser_token = ?`
  ).bind(browserToken).first();
  if (!existing) {
    await db.prepare(
      `INSERT INTO chat_users (browser_token, email, name, first_seen_at, last_seen_at, created_at, updated_at)
         VALUES (?, NULL, NULL, ?, ?, ?, ?)`
    ).bind(browserToken, currentIso, currentIso, currentIso, currentIso).run();
  } else {
    await db.prepare(
      `UPDATE chat_users SET last_seen_at = ?, updated_at = ? WHERE browser_token = ?`
    ).bind(currentIso, currentIso, browserToken).run();
  }
}
__name(ensureUser, "ensureUser");
async function recordAgeGateRendered(db, sessionId, browserToken) {
  await ensureSchema(db);
  const now = nowIso();
  await ensureSession(db, { sessionId, browserToken }, now);
  await db.prepare(
    `UPDATE chat_sessions SET age_gate_rendered_at = COALESCE(age_gate_rendered_at, ?), updated_at = ? WHERE session_id = ?`
  ).bind(now, now, sessionId).run();
  await db.prepare(
    `INSERT OR REPLACE INTO chat_events (event_id, session_id, message_id, search_sequence_id, event_type, product_id, rank_position, payload_json, occurred_at)
       VALUES (?, ?, NULL, NULL, ?, NULL, NULL, NULL, ?)`
  ).bind(crypto.randomUUID(), sessionId, "age_gate_rendered", now).run();
}
__name(recordAgeGateRendered, "recordAgeGateRendered");
async function recordAgeConfirmed(db, sessionId, browserToken) {
  await ensureSchema(db);
  const now = nowIso();
  await db.prepare(
    `UPDATE chat_sessions SET age_confirmed_at = COALESCE(age_confirmed_at, ?), updated_at = ? WHERE session_id = ?`
  ).bind(now, now, sessionId).run();
  await db.prepare(
    `INSERT OR REPLACE INTO chat_events (event_id, session_id, message_id, search_sequence_id, event_type, product_id, rank_position, payload_json, occurred_at)
       VALUES (?, ?, NULL, NULL, ?, NULL, NULL, NULL, ?)`
  ).bind(crypto.randomUUID(), sessionId, "age_confirmed", now).run();
  if (browserToken) {
    await ensureUser(db, browserToken, now);
  }
}
__name(recordAgeConfirmed, "recordAgeConfirmed");
async function recordAgeDeclined(db, sessionId, browserToken) {
  await ensureSchema(db);
  const now = nowIso();
  await db.prepare(
    `UPDATE chat_sessions SET age_declined_at = COALESCE(age_declined_at, ?), updated_at = ? WHERE session_id = ?`
  ).bind(now, now, sessionId).run();
  await db.prepare(
    `INSERT OR REPLACE INTO chat_events (event_id, session_id, message_id, search_sequence_id, event_type, product_id, rank_position, payload_json, occurred_at)
       VALUES (?, ?, NULL, NULL, ?, NULL, NULL, NULL, ?)`
  ).bind(crypto.randomUUID(), sessionId, "age_declined", now).run();
}
__name(recordAgeDeclined, "recordAgeDeclined");
function isAnalyticsEnabled(db) {
  return Boolean(db);
}
__name(isAnalyticsEnabled, "isAnalyticsEnabled");

// src/index.ts
var TIER = "FREE";
var RERANK_SKIP_CANDIDATE_MAX = 3;
function devLog(env, ...args) {
  if (env?.ENVIRONMENT === "development") {
    console.log(...args);
  }
}
__name(devLog, "devLog");
function buildTokenUsageResponse(modelName, usage, tier = TIER) {
  if (!usage) return null;
  const promptTokens = usage.prompt_tokens || 0;
  const completionTokens = usage.completion_tokens || 0;
  const totalTokens = usage.total_tokens || promptTokens + completionTokens;
  const tokenLimits = getTokenLimitsForModel(modelName, tier);
  return {
    tokenUsage: { promptTokens, completionTokens, totalTokens },
    model: modelName,
    modelContextLimit: tokenLimits.contextWindow
  };
}
__name(buildTokenUsageResponse, "buildTokenUsageResponse");
function getLastUserMessage(messages) {
  const lastUserMessage = [...messages].reverse().find((message) => message?.role === "user" && typeof message?.content === "string");
  return lastUserMessage?.content || "";
}
__name(getLastUserMessage, "getLastUserMessage");
function getAnalyticsContext(body) {
  return {
    sessionId: typeof body?.analytics?.session_id === "string" ? body.analytics.session_id : null,
    messageId: typeof body?.analytics?.message_id === "string" ? body.analytics.message_id : null,
    sourcePage: typeof body?.analytics?.source_page === "string" ? body.analytics.source_page : null,
    storeId: typeof body?.analytics?.store_id === "string" ? body.analytics.store_id : null,
    browserToken: typeof body?.analytics?.browser_token === "string" ? body.analytics.browser_token : null,
    predecessorSessionId: typeof body?.analytics?.predecessor_session_id === "string" ? body.analytics.predecessor_session_id : null,
    ageGateRequired: body?.analytics?.age_gate_required === true || body?.analytics?.age_gate_required === 1
  };
}
__name(getAnalyticsContext, "getAnalyticsContext");
function trackAnalytics(c, fn) {
  if (!isAnalyticsEnabled(c.env.ANALYTICS_DB)) return;
  c.executionCtx.waitUntil(
    fn(c.env.ANALYTICS_DB).catch((error) => {
      console.error("[Chat Analytics] Background write failed:", error);
    })
  );
}
__name(trackAnalytics, "trackAnalytics");
var app = new Hono2();
var FEEDBACK_FROM = "Wine Shop Feedback <noreply@xtscale.com>";
var FEEDBACK_TO = "info@xtscale.com";
var FEEDBACK_MAX_MESSAGE_LEN = 4e3;
var FEEDBACK_MAX_FILE_SIZE = 5 * 1024 * 1024;
var FEEDBACK_RATE_WINDOW_MS = 10 * 60 * 1e3;
var FEEDBACK_RATE_MAX = 5;
var ALLOWED_SCREENSHOT_MIME = /* @__PURE__ */ new Set(["image/png", "image/jpeg", "image/webp"]);
var TRANSCRIPT_FROM = "Wine Concierge <noreply@xtscale.com>";
var TRANSCRIPT_RATE_WINDOW_MS = 10 * 60 * 1e3;
var TRANSCRIPT_RATE_MAX = 5;
var TRANSCRIPT_MAX_MESSAGES = 40;
var TRANSCRIPT_MAX_RECOMMENDATIONS_PER_MESSAGE = 6;
var TRANSCRIPT_MAX_CONTENT_LEN = 4e3;
var feedbackRateLimitStore = /* @__PURE__ */ new Map();
var transcriptRateLimitStore = /* @__PURE__ */ new Map();
function cleanupRateLimitStore(now) {
  for (const [key, timestamps] of feedbackRateLimitStore.entries()) {
    const fresh = timestamps.filter((ts) => now - ts < FEEDBACK_RATE_WINDOW_MS);
    if (fresh.length === 0) {
      feedbackRateLimitStore.delete(key);
      continue;
    }
    feedbackRateLimitStore.set(key, fresh);
  }
}
__name(cleanupRateLimitStore, "cleanupRateLimitStore");
function isRateLimited(ip, now) {
  cleanupRateLimitStore(now);
  const timestamps = feedbackRateLimitStore.get(ip) ?? [];
  const fresh = timestamps.filter((ts) => now - ts < FEEDBACK_RATE_WINDOW_MS);
  if (fresh.length >= FEEDBACK_RATE_MAX) {
    feedbackRateLimitStore.set(ip, fresh);
    return true;
  }
  fresh.push(now);
  feedbackRateLimitStore.set(ip, fresh);
  return false;
}
__name(isRateLimited, "isRateLimited");
function cleanupTranscriptRateLimitStore(now) {
  for (const [key, timestamps] of transcriptRateLimitStore.entries()) {
    const fresh = timestamps.filter((ts) => now - ts < TRANSCRIPT_RATE_WINDOW_MS);
    if (fresh.length === 0) {
      transcriptRateLimitStore.delete(key);
      continue;
    }
    transcriptRateLimitStore.set(key, fresh);
  }
}
__name(cleanupTranscriptRateLimitStore, "cleanupTranscriptRateLimitStore");
function isTranscriptRateLimited(ip, now) {
  cleanupTranscriptRateLimitStore(now);
  const timestamps = transcriptRateLimitStore.get(ip) ?? [];
  const fresh = timestamps.filter((ts) => now - ts < TRANSCRIPT_RATE_WINDOW_MS);
  if (fresh.length >= TRANSCRIPT_RATE_MAX) {
    transcriptRateLimitStore.set(ip, fresh);
    return true;
  }
  fresh.push(now);
  transcriptRateLimitStore.set(ip, fresh);
  return false;
}
__name(isTranscriptRateLimited, "isTranscriptRateLimited");
function normalizeStore(rawStore) {
  return rawStore.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9._-]/g, "").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
}
__name(normalizeStore, "normalizeStore");
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
__name(isValidEmail, "isValidEmail");
function escapeHtml(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
__name(escapeHtml, "escapeHtml");
function toBase64(bytes) {
  let binary = "";
  const chunkSize = 32768;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}
__name(toBase64, "toBase64");
function safeTranscriptText(value) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, TRANSCRIPT_MAX_CONTENT_LEN);
}
__name(safeTranscriptText, "safeTranscriptText");
function safeTranscriptScalar(value) {
  const trimmed = safeTranscriptText(value);
  return trimmed || null;
}
__name(safeTranscriptScalar, "safeTranscriptScalar");
function safeTranscriptPrice(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return Number(value);
}
__name(safeTranscriptPrice, "safeTranscriptPrice");
function normalizeTranscriptMessages(rawMessages) {
  if (!Array.isArray(rawMessages)) return [];
  return rawMessages.slice(0, TRANSCRIPT_MAX_MESSAGES).map((entry) => {
    const rawMessage = entry && typeof entry === "object" ? entry : {};
    const role = rawMessage.role === "user" || rawMessage.role === "assistant" || rawMessage.role === "system" ? rawMessage.role : "assistant";
    const content = safeTranscriptText(rawMessage.content);
    const recommendations = Array.isArray(rawMessage.recommendations) ? rawMessage.recommendations.slice(0, TRANSCRIPT_MAX_RECOMMENDATIONS_PER_MESSAGE).map((recommendation) => {
      const rawRecommendation = recommendation && typeof recommendation === "object" ? recommendation : {};
      return {
        name: safeTranscriptScalar(rawRecommendation.name) ?? void 0,
        brand: safeTranscriptScalar(rawRecommendation.brand) ?? void 0,
        price: safeTranscriptPrice(rawRecommendation.price),
        shop_link: safeTranscriptScalar(rawRecommendation.shop_link),
        wine_type: safeTranscriptScalar(rawRecommendation.wine_type),
        varietal: safeTranscriptScalar(rawRecommendation.varietal),
        region: safeTranscriptScalar(rawRecommendation.region)
      };
    }).filter((recommendation) => recommendation.name || recommendation.shop_link || recommendation.price != null) : [];
    return { role, content, recommendations };
  }).filter((entry) => entry.content || entry.recommendations.length > 0);
}
__name(normalizeTranscriptMessages, "normalizeTranscriptMessages");
function formatTranscriptPrice(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "Price unavailable";
  }
  return `$${value.toFixed(2)}`;
}
__name(formatTranscriptPrice, "formatTranscriptPrice");
function buildTranscriptEmail(profileName, messages, name, sourcePage, submittedAt) {
  let recommendationCount = 0;
  const textSections = messages.map((message) => {
    const speaker = message.role === "user" ? "You" : message.role === "system" ? "System" : "Sommelier";
    const lines = [`${speaker}:`];
    if (message.content) {
      lines.push(message.content);
    }
    if (message.recommendations.length > 0) {
      recommendationCount += message.recommendations.length;
      lines.push("Recommendations:");
      for (const recommendation of message.recommendations) {
        const detailParts = [
          recommendation.brand,
          recommendation.wine_type,
          recommendation.varietal,
          recommendation.region
        ].filter(Boolean);
        lines.push(`- ${recommendation.name ?? "Recommended bottle"}${detailParts.length > 0 ? ` (${detailParts.join(" \u2022 ")})` : ""}`);
        lines.push(`  ${formatTranscriptPrice(recommendation.price)}`);
        if (recommendation.shop_link) {
          lines.push(`  ${recommendation.shop_link}`);
        }
      }
    }
    return lines.join("\n");
  });
  const htmlSections = messages.map((message) => {
    const speaker = message.role === "user" ? "You" : message.role === "system" ? "System" : "Sommelier";
    const productsHtml = message.recommendations.length > 0 ? `<div style="margin-top:12px;"><div style="font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#6b7280;margin-bottom:8px;">Recommendations</div><ul style="margin:0;padding-left:18px;">${message.recommendations.map((recommendation) => {
      const detailParts = [
        recommendation.brand,
        recommendation.wine_type,
        recommendation.varietal,
        recommendation.region
      ].filter(Boolean);
      return `<li style="margin-bottom:10px;"><div style="font-weight:600;color:#111827;">${escapeHtml(recommendation.name ?? "Recommended bottle")}</div><div style="color:#6b7280;font-size:13px;">${escapeHtml(detailParts.join(" \u2022 ")) || "&nbsp;"}</div><div style="color:#111827;font-size:13px;">${escapeHtml(formatTranscriptPrice(recommendation.price))}</div>${recommendation.shop_link ? `<div style="font-size:13px;"><a href="${escapeHtml(recommendation.shop_link)}" style="color:#1d4ed8;">View bottle</a></div>` : ""}</li>`;
    }).join("")}</ul></div>` : "";
    return `<section style="padding:16px 0;border-top:1px solid #e5e7eb;"><div style="font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#6b7280;margin-bottom:8px;">${escapeHtml(speaker)}</div>${message.content ? `<div style="font-size:14px;line-height:1.6;color:#111827;">${escapeHtml(message.content).replace(/\n/g, "<br />")}</div>` : ""}${productsHtml}</section>`;
  });
  const salutation = name ? `Hi ${escapeHtml(name)},` : "Hi,";
  const sourceLine = sourcePage ? `<p style="margin:0 0 12px;color:#6b7280;font-size:13px;">Source page: ${escapeHtml(sourcePage)}</p>` : "";
  return {
    recommendationCount,
    textBody: [
      `${profileName} Chat Transcript`,
      `Generated (UTC): ${submittedAt}`,
      sourcePage ? `Source Page: ${sourcePage}` : null,
      "",
      ...textSections
    ].filter(Boolean).join("\n"),
    htmlBody: `
      <div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;padding:24px;background:#faf8f3;">
        <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;padding:24px;">
          <p style="margin:0 0 8px;color:#111827;font-size:14px;">${salutation}</p>
          <h1 style="margin:0 0 8px;color:#111827;font-size:24px;">Your ${escapeHtml(profileName)} chat transcript</h1>
          <p style="margin:0 0 8px;color:#4b5563;font-size:14px;">Generated ${escapeHtml(submittedAt)}.</p>
          ${sourceLine}
          ${htmlSections.join("")}
        </div>
      </div>
    `
  };
}
__name(buildTranscriptEmail, "buildTranscriptEmail");
app.use("*", cors({
  origin: /* @__PURE__ */ __name((origin) => origin || "*", "origin"),
  allowMethods: ["GET", "POST", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));
app.onError((err, c) => {
  if (err instanceof SyntaxError) {
    return c.json({ error: "Invalid JSON format", message: err.message }, 400);
  }
  console.error(`Status: ${err.name}`, err.message);
  return c.json({ error: "Internal Server Error" }, 500);
});
app.options("/chat", () => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
  });
});
app.get("/", (c) => {
  const profile = getProfile(c.env.PROFILE_TYPE);
  return c.text(`${profile.storeName} Wine Chat API`);
});
app.get("/chat/config", async (c) => {
  const profile = getProfile(c.env.PROFILE_TYPE);
  let catalogFacets = null;
  try {
    const facetFilters = !profile.allowCrossBrand && profile.brandName ? { brand: profile.brandName } : {};
    catalogFacets = await getCatalogFacets(c.env.WINE_DB, facetFilters);
  } catch (error) {
    console.error("[Config] Failed to build catalog facets:", error);
  }
  return c.json({
    profileType: profile.profileType,
    storeName: profile.storeName,
    storeDescription: profile.storeDescription,
    brandName: profile.brandName ?? null,
    guidedFlowType: profile.guidedFlowType,
    welcomeMessage: profile.welcomeMessage,
    quickStartSuggestions: profile.quickStartSuggestions,
    features: profile.features,
    catalogFacets,
    wineClubConfig: profile.wineClubConfig ?? null,
    giftingConfig: profile.giftingConfig ?? null,
    brandContent: profile.brandContent ? {
      shippingPolicy: profile.brandContent.shippingPolicy,
      returnPolicy: profile.brandContent.returnPolicy,
      storeHours: profile.brandContent.storeHours,
      dealerLocatorUrl: profile.brandContent.dealerLocatorUrl,
      heritage: profile.brandContent.heritage
    } : null
  });
});
app.post("/chat/lead", async (c) => {
  const profile = getProfile(c.env.PROFILE_TYPE);
  try {
    const body = await c.req.json();
    const { email, name, intentSignal, sessionId, sourcePage, tastePreferences } = body;
    if (!email || typeof email !== "string") {
      return c.json({ error: "Email is required" }, 400);
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return c.json({ error: "Invalid email format" }, 400);
    }
    if (!isAnalyticsEnabled(c.env.ANALYTICS_DB)) {
      devLog(c.env, "[Lead Capture] ANALYTICS_DB not configured, skipping DB write");
      return c.json({ ok: true, leadId: null, message: "Lead capture not configured" });
    }
    const leadId = await recordLeadCapture(c.env.ANALYTICS_DB, {
      sessionId: sessionId || "unknown",
      email,
      name: name || null,
      intentSignal: intentSignal || "general",
      profileType: profile.profileType,
      tastePreferences: tastePreferences || null,
      sourcePage: sourcePage || null
    });
    devLog(c.env, `[Lead Capture] Lead captured: ${leadId} (${email})`);
    return c.json({ ok: true, leadId });
  } catch (error) {
    console.error("[Lead Capture] Error:", error.message);
    return c.json({ error: "Failed to capture lead" }, 500);
  }
});
app.post("/chat/transcript", async (c) => {
  const profile = getProfile(c.env.PROFILE_TYPE);
  try {
    const body = await c.req.json();
    const email = typeof body?.email === "string" ? body.email.trim() : "";
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const subscribe = Boolean(body?.subscribe);
    const sessionId = typeof body?.sessionId === "string" ? body.sessionId : "unknown";
    const sourcePage = typeof body?.sourcePage === "string" ? body.sourcePage.trim() : null;
    const transcriptMessages = normalizeTranscriptMessages(body?.messages);
    const ip = c.req.header("CF-Connecting-IP") || "unknown";
    if (!email) {
      return c.json({ ok: false, error: "validation_error", message: "Email is required." }, 400);
    }
    if (!isValidEmail(email)) {
      return c.json({ ok: false, error: "validation_error", message: "Email format is invalid." }, 400);
    }
    if (transcriptMessages.length === 0) {
      return c.json({ ok: false, error: "validation_error", message: "No transcript content is available to send." }, 400);
    }
    const now = Date.now();
    if (isTranscriptRateLimited(ip, now)) {
      return c.json({ ok: false, error: "rate_limited", message: "Too many transcript requests. Please try again later." }, 429);
    }
    const submittedAt = new Date(now).toISOString();
    const { textBody, htmlBody, recommendationCount } = buildTranscriptEmail(
      profile.storeName,
      transcriptMessages,
      name || null,
      sourcePage,
      submittedAt
    );
    const resendResp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${c.env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: TRANSCRIPT_FROM,
        to: [email],
        subject: `Your ${profile.storeName} chat transcript`,
        text: textBody,
        html: htmlBody
      })
    });
    const resendData = await resendResp.json().catch(() => ({}));
    if (!resendResp.ok || !resendData?.id) {
      console.error("[Transcript] Resend error:", resendData);
      return c.json({ ok: false, error: "email_provider_error", message: "Transcript email could not be delivered." }, 502);
    }
    let leadId = null;
    if (subscribe && isAnalyticsEnabled(c.env.ANALYTICS_DB)) {
      leadId = await recordLeadCapture(c.env.ANALYTICS_DB, {
        sessionId,
        email,
        name: name || null,
        intentSignal: "transcript_opt_in",
        profileType: profile.profileType,
        tastePreferences: {
          messageCount: transcriptMessages.length,
          recommendationCount
        },
        sourcePage
      });
    }
    return c.json({ ok: true, id: resendData.id, leadId });
  } catch (error) {
    console.error("[Transcript] Unexpected error:", error);
    return c.json({ ok: false, error: "internal_error", message: "Unexpected error while sending transcript." }, 500);
  }
});
app.post("/feedback", async (c) => {
  const profile = getProfile(c.env.PROFILE_TYPE);
  try {
    const formData = await c.req.formData();
    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const type = String(formData.get("type") ?? "").trim().toLowerCase();
    const message = String(formData.get("message") ?? "").trim();
    const rawStore = String(formData.get("store") ?? "");
    const source = String(formData.get("source") ?? "widget").trim();
    const pageUrl = String(formData.get("pageUrl") ?? "").trim();
    const userAgent = String(formData.get("userAgent") ?? "").trim() || c.req.header("user-agent") || "";
    const screenshot = formData.get("screenshot");
    const ip = c.req.header("CF-Connecting-IP") || "unknown";
    const store = normalizeStore(rawStore);
    if (!store) {
      return c.json({ ok: false, error: "validation_error", message: "Store is required." }, 400);
    }
    if (!["bug", "quality", "safety", "other"].includes(type)) {
      return c.json({ ok: false, error: "validation_error", message: "Invalid feedback type." }, 400);
    }
    if (!message || message.length < 5 || message.length > FEEDBACK_MAX_MESSAGE_LEN) {
      return c.json({ ok: false, error: "validation_error", message: "Message must be between 5 and 4000 characters." }, 400);
    }
    if (email && !isValidEmail(email)) {
      return c.json({ ok: false, error: "validation_error", message: "Email format is invalid." }, 400);
    }
    const now = Date.now();
    if (isRateLimited(ip, now)) {
      return c.json({ ok: false, error: "rate_limited", message: "Too many submissions. Please try again later." }, 429);
    }
    let attachment;
    if (screenshot && screenshot instanceof File && screenshot.size > 0) {
      if (screenshot.size > FEEDBACK_MAX_FILE_SIZE) {
        return c.json({ ok: false, error: "file_too_large", message: "Screenshot must be 5MB or smaller." }, 413);
      }
      if (!ALLOWED_SCREENSHOT_MIME.has(screenshot.type)) {
        return c.json({ ok: false, error: "unsupported_file_type", message: "Only PNG, JPEG, and WEBP screenshots are allowed." }, 415);
      }
      const bytes = new Uint8Array(await screenshot.arrayBuffer());
      attachment = {
        filename: screenshot.name || "feedback-screenshot",
        content: toBase64(bytes),
        content_type: screenshot.type
      };
    }
    const submittedAt = new Date(now).toISOString();
    const subject = `[${profile.storeName} Feedback][store:${store}][type:${type}]`;
    const textBody = [
      `Store (normalized): ${store}`,
      `Store (raw): ${rawStore || "N/A"}`,
      `Source: ${source || "N/A"}`,
      `Submitted At (UTC): ${submittedAt}`,
      `Name: ${name || "N/A"}`,
      `Email: ${email || "N/A"}`,
      `Type: ${type}`,
      `Page URL: ${pageUrl || "N/A"}`,
      `User Agent: ${userAgent || "N/A"}`,
      `IP: ${ip}`,
      `Screenshot: ${attachment ? "Attached" : "None"}`,
      "",
      "Message:",
      message
    ].join("\n");
    const htmlBody = `
      <h2>${escapeHtml(profile.storeName)} Feedback Submission</h2>
      <p><strong>Store (normalized):</strong> ${escapeHtml(store)}</p>
      <p><strong>Store (raw):</strong> ${escapeHtml(rawStore || "N/A")}</p>
      <p><strong>Source:</strong> ${escapeHtml(source || "N/A")}</p>
      <p><strong>Submitted At (UTC):</strong> ${escapeHtml(submittedAt)}</p>
      <p><strong>Name:</strong> ${escapeHtml(name || "N/A")}</p>
      <p><strong>Email:</strong> ${escapeHtml(email || "N/A")}</p>
      <p><strong>Type:</strong> ${escapeHtml(type)}</p>
      <p><strong>Page URL:</strong> ${escapeHtml(pageUrl || "N/A")}</p>
      <p><strong>User Agent:</strong> ${escapeHtml(userAgent || "N/A")}</p>
      <p><strong>IP:</strong> ${escapeHtml(ip)}</p>
      <p><strong>Screenshot:</strong> ${attachment ? "Attached" : "None"}</p>
      <hr />
      <p><strong>Message</strong></p>
      <p>${escapeHtml(message).replace(/\n/g, "<br />")}</p>
    `;
    const resendPayload = {
      from: FEEDBACK_FROM,
      to: [FEEDBACK_TO],
      subject,
      text: textBody,
      html: htmlBody
    };
    if (attachment) {
      resendPayload.attachments = [attachment];
    }
    const resendResp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${c.env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(resendPayload)
    });
    const resendData = await resendResp.json().catch(() => ({}));
    if (!resendResp.ok || !resendData?.id) {
      console.error("[Feedback] Resend error:", resendData);
      return c.json({ ok: false, error: "email_provider_error", message: "Feedback could not be delivered." }, 502);
    }
    return c.json({ ok: true, id: resendData.id });
  } catch (err) {
    console.error("[Feedback] Unexpected error:", err);
    return c.json({ ok: false, error: "internal_error", message: "Unexpected error while sending feedback." }, 500);
  }
});
app.post("/chat/compare", async (c) => {
  try {
    const body = await c.req.json();
    const { wine1, wine2 } = body;
    if (!wine1 || !wine2) {
      return c.json({ error: "Two wine names are required" }, 400);
    }
    const [results1, results2] = await Promise.all([
      lookupWineByName(c.env.WINE_DB, wine1, 1),
      lookupWineByName(c.env.WINE_DB, wine2, 1)
    ]);
    if (results1.length === 0 || results2.length === 0) {
      return c.json({
        error: "comparison_incomplete",
        found: {
          wine1: results1.length > 0 ? results1[0] : null,
          wine2: results2.length > 0 ? results2[0] : null
        },
        message: `Could not find ${results1.length === 0 ? wine1 : wine2} in our catalog.`
      });
    }
    return c.json({
      comparison: {
        wine1: results1[0],
        wine2: results2[0]
      }
    });
  } catch (error) {
    console.error("[Compare] Error:", error.message);
    return c.json({ error: "Failed to compare wines" }, 500);
  }
});
app.post("/chat/intent", async (c) => {
  const body = await c.req.json();
  const messages = body.messages || [];
  const analytics = getAnalyticsContext(body);
  const userTextRaw = getLastUserMessage(messages);
  const intentStartedAt = Date.now();
  const lastMessage = messages[messages.length - 1]?.content || "";
  const lastAssistantMsg = messages.filter((m) => m.role === "assistant").pop();
  const lastAssistantContent = lastAssistantMsg?.content || "";
  const assistantQuery = lastAssistantContent;
  const RECOMMEND_CUES = [
    "I completely understand what you're looking for",
    "Let me check what we have that matches your preferences",
    "I'm pulling up wines that fit your criteria",
    "Checking our selection based on what you described"
  ];
  const PRODUCT_CUES = [
    "Let me look up",
    "I'll pull up the details on"
  ];
  const hasRecommendCue = RECOMMEND_CUES.some((cue) => lastAssistantContent.includes(cue));
  const hasProductCue = PRODUCT_CUES.some((cue) => lastAssistantContent.includes(cue));
  if (!hasRecommendCue && !hasProductCue) {
    trackAnalytics(
      c,
      (db) => recordIntentAnalysis(db, {
        analytics,
        userTextRaw,
        predictedIntent: "general",
        status: "completed",
        latencyMs: Date.now() - intentStartedAt
      })
    );
    return c.json({
      intent: "general",
      filters: {},
      product_query: null,
      assistantQuery
    });
  }
  if (hasProductCue) {
    const lookupMatch = lastAssistantContent.match(/Let me look up (.+?) for you/i) || lastAssistantContent.match(/I'll pull up the details on (.+)/i);
    const productName = lookupMatch ? lookupMatch[1].trim() : lastMessage;
    trackAnalytics(
      c,
      (db) => recordIntentAnalysis(db, {
        analytics,
        userTextRaw,
        predictedCue: "PRODUCT_LOOKUP",
        predictedIntent: "product-question",
        productQuery: productName,
        status: "completed",
        latencyMs: Date.now() - intentStartedAt
      })
    );
    return c.json({
      intent: "product-question",
      filters: {},
      product_query: productName,
      assistantQuery
    });
  }
  const API_KEY = getApiKey(INTENT_PROVIDER, c.env);
  const MODEL = getModelForRole(INTENT_PROVIDER, "INTENT");
  const BASE_URL = getBaseUrl(INTENT_PROVIDER);
  const schemaInfo = getWineSchemaForPrompt();
  let tokenUsage = null;
  const prompt = generateIntentWithCuePrompt(lastAssistantContent, lastMessage, schemaInfo);
  let text;
  try {
    const resp = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "system", content: prompt }],
        temperature: 0,
        max_tokens: 1e3,
        stream: false
      })
    });
    if (!resp.ok) {
      const errorText = await resp.text();
      console.error(`Intent API error (${resp.status}):`, errorText);
      throw new Error(`Intent API returned ${resp.status}: ${errorText}`);
    }
    const data = await resp.json();
    text = data.choices?.[0]?.message?.content || "";
    tokenUsage = buildTokenUsageResponse(MODEL, data.usage, TIER);
    if (!text || text.trim().length === 0) {
      console.error("Intent API returned empty response:", JSON.stringify(data, null, 2));
      throw new Error("Intent API returned empty content");
    }
  } catch (err) {
    console.error(`/intent api error: ${err}`);
    trackAnalytics(
      c,
      (db) => recordIntentAnalysis(db, {
        analytics,
        userTextRaw,
        predictedCue: "RECOMMEND",
        predictedIntent: "recommendation",
        status: "error",
        errorCode: "intent_api_error",
        latencyMs: Date.now() - intentStartedAt
      })
    );
    return c.json({
      error: "Our AI understanding service is experiencing technical difficulties. Please try again.",
      service: "intent",
      intent: "general",
      filters: {},
      assistantQuery,
      details: {
        message: err instanceof Error ? err.message : String(err),
        provider: INTENT_PROVIDER
      }
    }, 503);
  }
  const parseResult = parseRobustJSON(text);
  if (!parseResult.success) {
    console.error("Failed to parse intent response:", {
      error: parseResult.error,
      rawResponse: text?.substring(0, 500)
    });
    trackAnalytics(
      c,
      (db) => recordIntentAnalysis(db, {
        analytics,
        userTextRaw,
        predictedCue: "RECOMMEND",
        predictedIntent: "recommendation",
        status: "error",
        errorCode: "intent_json_parse_error",
        latencyMs: Date.now() - intentStartedAt
      })
    );
    return c.json({
      error: "Filter extraction failed - JSON parsing error",
      intent: "recommendation",
      filters: {},
      product_query: null,
      assistantQuery
    }, 400);
  }
  const parsed = parseResult.data;
  const isSurprise = parsed.intent === "surprise";
  const normalizedFilters = validateWineFilters(parsed.filters || {});
  const profile = getProfile(c.env.PROFILE_TYPE);
  if (!profile.allowCrossBrand && profile.brandName) {
    normalizedFilters.brand = profile.brandName;
  }
  trackAnalytics(
    c,
    (db) => recordIntentAnalysis(db, {
      analytics,
      userTextRaw,
      predictedCue: "RECOMMEND",
      predictedIntent: isSurprise ? "surprise" : "recommendation",
      predictedFilters: normalizedFilters,
      status: "completed",
      latencyMs: Date.now() - intentStartedAt
    })
  );
  return c.json({
    intent: isSurprise ? "surprise" : "recommendation",
    filters: normalizedFilters,
    product_query: null,
    assistantQuery,
    ...tokenUsage ? { tokenUsage } : {}
  });
});
app.post("/chat/product-lookup", async (c) => {
  const body = await c.req.json();
  const productQuery = body.product_query || "";
  const messages = body.messages || [];
  const analytics = getAnalyticsContext(body);
  const userTextRaw = getLastUserMessage(messages) || productQuery;
  const lookupStartedAt = Date.now();
  if (!productQuery) {
    trackAnalytics(
      c,
      (db) => recordProductLookupResult(db, {
        analytics,
        userTextRaw,
        predictedCue: "PRODUCT_LOOKUP",
        predictedIntent: "product-question",
        status: "error",
        fallbackReason: "missing_product_query",
        latencyMs: Date.now() - lookupStartedAt
      })
    );
    return c.json({
      product: null,
      confidence: 0,
      needsClarification: false,
      message: "No product query provided"
    });
  }
  try {
    const results = await lookupWineByName(c.env.WINE_DB, productQuery, 3);
    if (results.length === 0) {
      trackAnalytics(
        c,
        (db) => recordProductLookupResult(db, {
          analytics,
          userTextRaw,
          productQuery,
          predictedCue: "PRODUCT_LOOKUP",
          predictedIntent: "product-question",
          status: "completed",
          fallbackReason: "no_match",
          latencyMs: Date.now() - lookupStartedAt
        })
      );
      return c.json({
        product: null,
        confidence: 0,
        needsClarification: false,
        message: "I couldn't find that wine in our catalog. Would you like me to search for recommendations?"
      });
    }
    if (results.length === 1) {
      const wine = results[0];
      trackAnalytics(
        c,
        (db) => recordProductLookupResult(db, {
          analytics,
          userTextRaw,
          productQuery,
          predictedCue: "PRODUCT_LOOKUP",
          predictedIntent: "product-question",
          product: {
            id: wine.id,
            name: wine.name,
            brand: wine.brand,
            category: wine.wine_type,
            rankPosition: 1,
            sourceKind: "product_lookup"
          },
          status: "completed",
          latencyMs: Date.now() - lookupStartedAt
        })
      );
      return c.json({
        product: wine,
        confidence: 1,
        needsClarification: false
      });
    }
    const topNames = results.map((r) => r.name).filter(Boolean);
    trackAnalytics(
      c,
      (db) => recordProductLookupResult(db, {
        analytics,
        userTextRaw,
        productQuery,
        predictedCue: "PRODUCT_LOOKUP",
        predictedIntent: "product-question",
        needsClarification: true,
        status: "completed",
        fallbackReason: "clarification",
        latencyMs: Date.now() - lookupStartedAt
      })
    );
    return c.json({
      product: null,
      confidence: 0.5,
      needsClarification: true,
      suggestedNames: topNames,
      message: topNames.length > 1 ? `Did you mean ${topNames.slice(0, -1).join(", ")} or ${topNames[topNames.length - 1]}?` : `Did you mean ${topNames[0]}?`
    });
  } catch (err) {
    console.error("Product lookup error:", err);
    trackAnalytics(
      c,
      (db) => recordProductLookupResult(db, {
        analytics,
        userTextRaw,
        productQuery,
        predictedCue: "PRODUCT_LOOKUP",
        predictedIntent: "product-question",
        status: "error",
        fallbackReason: "lookup_error",
        latencyMs: Date.now() - lookupStartedAt
      })
    );
    return c.json({
      product: null,
      confidence: 0,
      needsClarification: false,
      error: "Product lookup service temporarily unavailable",
      message: "I'm having trouble searching for that wine. Would you like me to search for recommendations instead?"
    });
  }
});
app.post("/chat/stream", async (c) => {
  const body = await c.req.json();
  const messages = body.messages || [];
  const productContext = body.productContext || null;
  const clarificationContext = body.clarificationContext || null;
  const analytics = getAnalyticsContext(body);
  const userTextRaw = getLastUserMessage(messages);
  const streamStartedAt = Date.now();
  if (clarificationContext) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        const sseEvent = `data: ${JSON.stringify({
          choices: [{
            delta: { content: clarificationContext },
            finish_reason: null
          }]
        })}

`;
        controller.enqueue(encoder.encode(sseEvent));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    });
    trackAnalytics(
      c,
      (db) => recordStreamCompletion(db, {
        analytics,
        userTextRaw,
        assistantResponseText: clarificationContext,
        latencyMs: Date.now() - streamStartedAt,
        status: "completed"
      })
    );
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
  const API_KEY = getApiKey(STREAM_PROVIDER, c.env);
  const MODEL = getModelForRole(STREAM_PROVIDER, "STREAM");
  const BASE_URL = getBaseUrl(STREAM_PROVIDER);
  const lastMessages = messages.slice(-10);
  const enrichedHistory = lastMessages.map((msg) => {
    if (msg.recommendations?.length > 0) {
      const names = msg.recommendations.map((p) => p.name).join(", ");
      return {
        role: "assistant",
        content: `${msg.content}

I recommended: ${names}.`
      };
    }
    return { role: msg.role, content: msg.content };
  });
  const conversation_history = formatConversationHistory(enrichedHistory);
  const user_message = enrichedHistory[enrichedHistory.length - 1]?.content || "";
  const prompt = generatePrompt(
    "llama",
    user_message,
    conversation_history,
    productContext || "",
    clarificationContext || void 0,
    false,
    c.env.PROFILE_TYPE
  );
  const cleanMessages = lastMessages.map((msg) => {
    const { recommendations, ...rest } = msg;
    return rest;
  });
  const messagesForLLM = [
    { role: "system", content: "Hello." },
    { role: "system", content: prompt },
    ...cleanMessages
  ];
  let response;
  try {
    response = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: MODEL,
        messages: messagesForLLM,
        temperature: 0.1,
        max_tokens: 900,
        stream: true
      })
    });
    if (!response || !response.ok) {
      const errorText = response ? await response.text() : "Network error";
      console.error(`Stream API error (${response?.status || "network"}):`, errorText);
      trackAnalytics(
        c,
        (db) => recordStreamCompletion(db, {
          analytics,
          userTextRaw,
          latencyMs: Date.now() - streamStartedAt,
          status: "error",
          errorCode: "stream_api_error"
        })
      );
      return c.json({
        error: "Our streaming service is experiencing technical difficulties. Please try again.",
        service: "stream",
        details: {
          status: response?.status || null,
          statusText: response?.statusText || "Network error",
          provider: STREAM_PROVIDER
        }
      }, 503);
    }
  } catch (err) {
    console.error(`Stream Error: ${err}`);
    trackAnalytics(
      c,
      (db) => recordStreamCompletion(db, {
        analytics,
        userTextRaw,
        latencyMs: Date.now() - streamStartedAt,
        status: "error",
        errorCode: "stream_network_error"
      })
    );
    return c.json({
      error: "Our streaming service is experiencing technical difficulties. Please try again.",
      service: "stream",
      details: {
        message: err instanceof Error ? err.message : String(err),
        provider: STREAM_PROVIDER
      }
    }, 503);
  }
  if (!response?.body) {
    trackAnalytics(
      c,
      (db) => recordStreamCompletion(db, {
        analytics,
        userTextRaw,
        latencyMs: Date.now() - streamStartedAt,
        status: "error",
        errorCode: "stream_missing_body"
      })
    );
    return c.json({
      error: "Our streaming service is experiencing technical difficulties. Please try again.",
      service: "stream",
      details: {
        status: response?.status || null,
        statusText: response?.statusText || "Missing response body",
        provider: STREAM_PROVIDER
      }
    }, 503);
  }
  const { readable, writable } = new TransformStream();
  const upstreamReader = response.body.getReader();
  const downstreamWriter = writable.getWriter();
  const decoder = new TextDecoder("utf-8");
  if (isAnalyticsEnabled(c.env.ANALYTICS_DB)) {
    c.executionCtx.waitUntil((async () => {
      let buffer = "";
      let assistantResponseText = "";
      const consumeSseBuffer = /* @__PURE__ */ __name((rawBuffer, flush = false) => {
        const parts = rawBuffer.split("\n\n");
        const completeParts = flush ? parts : parts.slice(0, -1);
        for (const part of completeParts) {
          const event = part.trim();
          if (!event) continue;
          const dataIndex = event.indexOf("data: ");
          if (dataIndex === -1) continue;
          const jsonStr = event.slice(dataIndex + 6);
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const token = parsed.choices?.[0]?.delta?.content ?? "";
            if (token) {
              assistantResponseText += token;
            }
          } catch (error) {
            console.error("[STREAM] Failed to parse SSE chunk for analytics:", error);
          }
        }
        return flush ? "" : parts[parts.length - 1];
      }, "consumeSseBuffer");
      try {
        while (true) {
          const { done, value } = await upstreamReader.read();
          if (done) break;
          if (value) {
            await downstreamWriter.write(value);
            buffer += decoder.decode(value, { stream: true });
            buffer = consumeSseBuffer(buffer, false);
          }
        }
        buffer += decoder.decode();
        consumeSseBuffer(buffer, true);
      } catch (error) {
        console.error("[STREAM] Failed while mirroring upstream SSE:", error);
      } finally {
        try {
          await downstreamWriter.close();
        } catch {
        }
      }
      await recordStreamCompletion(c.env.ANALYTICS_DB, {
        analytics,
        userTextRaw,
        assistantResponseText,
        latencyMs: Date.now() - streamStartedAt,
        status: "completed"
      });
    })().catch((error) => {
      console.error("[STREAM] Analytics mirror task failed:", error);
    }));
  } else {
    c.executionCtx.waitUntil((async () => {
      try {
        while (true) {
          const { done, value } = await upstreamReader.read();
          if (done) break;
          if (value) {
            await downstreamWriter.write(value);
          }
        }
      } finally {
        try {
          await downstreamWriter.close();
        } catch {
        }
      }
    })());
  }
  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*"
    }
  });
});
app.post("/chat/recommendations", async (c) => {
  const body = await c.req.json();
  const messages = body.messages || [];
  let filters = body.filters || {};
  const analytics = getAnalyticsContext(body);
  const userTextRaw = getLastUserMessage(messages);
  const recommendationsStartedAt = Date.now();
  const isSurprise = body.intent === "surprise";
  filters = validateWineFilters(filters);
  const profile = getProfile(c.env.PROFILE_TYPE);
  if (!profile.allowCrossBrand && profile.brandName) {
    filters.brand = profile.brandName;
  }
  const lastMessages = messages.slice(-5);
  const enrichedHistory = lastMessages.map((msg) => {
    if (msg.recommendations?.length > 0) {
      const names = msg.recommendations.map((p) => p.name).join(", ");
      return {
        role: "assistant",
        content: `${msg.content}

I recommended: ${names}.`
      };
    }
    return { role: msg.role, content: msg.content };
  });
  const user_message = enrichedHistory[enrichedHistory.length - 1]?.content || "";
  const lastAssistantMessage = enrichedHistory.slice(-2).find((m) => m.role === "assistant")?.content || "";
  let results = [];
  let searchFallbackReason = isSurprise ? "surprise_random" : "exact_match";
  let appliedSearchFilters = filters;
  try {
    if (isSurprise) {
      results = await surpriseMe(c.env.WINE_DB, filters, 8);
      if (results.length === 0) {
        const broadenedFilters = {};
        if (filters.brand) broadenedFilters.brand = filters.brand;
        if (filters.wine_type) broadenedFilters.wine_type = filters.wine_type;
        results = await surpriseMe(c.env.WINE_DB, broadenedFilters, 8);
        searchFallbackReason = results.length > 0 ? "surprise_broadened" : "no_valid_catalog_results";
        appliedSearchFilters = broadenedFilters;
      }
    } else {
      const searchResult = await searchWinesWithFallback(c.env.WINE_DB, filters, 8);
      results = searchResult.results;
      searchFallbackReason = searchResult.fallbackReason;
      appliedSearchFilters = searchResult.appliedFilters;
    }
  } catch (err) {
    console.error("Wine search error:", err);
    trackAnalytics(
      c,
      (db) => recordRecommendationResults(db, {
        analytics,
        userTextRaw,
        predictedCue: "RECOMMEND",
        predictedIntent: isSurprise ? "surprise" : "recommendation",
        predictedFilters: filters,
        recommendations: [],
        preRankedCount: 0,
        finalRankCount: 0,
        status: "error",
        errorCode: "wine_search_error",
        fallbackReason: `search:${searchFallbackReason}|wine_search_error`,
        latencyMs: Date.now() - recommendationsStartedAt
      })
    );
    return c.json({ recommendations: [], error: "Wine search error" }, 200);
  }
  if (results.length === 0) {
    trackAnalytics(
      c,
      (db) => recordRecommendationResults(db, {
        analytics,
        userTextRaw,
        predictedCue: "RECOMMEND",
        predictedIntent: isSurprise ? "surprise" : "recommendation",
        predictedFilters: filters,
        recommendations: [],
        preRankedCount: 0,
        finalRankCount: 0,
        status: "completed",
        fallbackReason: `search:${searchFallbackReason}`,
        latencyMs: Date.now() - recommendationsStartedAt
      })
    );
    return c.json({
      recommendations: [],
      error: "No wines found matching your criteria",
      service: "recommendations",
      appliedFilters: appliedSearchFilters,
      fallbackReason: searchFallbackReason
    }, 200);
  }
  const productMap = new Map(results.map((r) => [r.id, r]));
  if (results.length <= RERANK_SKIP_CANDIDATE_MAX) {
    trackAnalytics(
      c,
      (db) => recordRecommendationResults(db, {
        analytics,
        userTextRaw,
        predictedCue: "RECOMMEND",
        predictedIntent: isSurprise ? "surprise" : "recommendation",
        predictedFilters: filters,
        recommendations: results.map((result, index) => ({
          id: typeof result.id === "string" ? result.id : null,
          name: typeof result.name === "string" ? result.name : null,
          brand: typeof result.brand === "string" ? result.brand : null,
          category: result.wine_type || null,
          rankPosition: index + 1,
          sourceKind: "recommendation"
        })),
        preRankedCount: results.length,
        finalRankCount: results.length,
        status: "completed",
        fallbackReason: `search:${searchFallbackReason}|rerank_skipped_small_candidate_set`,
        latencyMs: Date.now() - recommendationsStartedAt
      })
    );
    return c.json({
      recommendations: results,
      preRankedProducts: results,
      reasoning: "Skipped rerank because the candidate set was already narrow.",
      appliedFilters: appliedSearchFilters,
      fallbackReason: searchFallbackReason
    }, 200);
  }
  const API_KEY = getApiKey(RERANK_PROVIDER, c.env);
  const MODEL = getModelForRole(RERANK_PROVIDER, "RECOMMEND");
  const BASE_URL = getBaseUrl(RERANK_PROVIDER);
  let tokenUsage = null;
  const queryForReranking = lastAssistantMessage || user_message;
  const rerankCandidates = buildCompactRerankCandidates(results);
  const reRankPrompt = generateReRankPrompt(queryForReranking, filters, rerankCandidates);
  let text;
  try {
    const resp = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "system", content: reRankPrompt }],
        temperature: 0.1,
        max_tokens: 2500,
        stream: false
      })
    });
    if (!resp.ok) {
      const errorText = await resp.text();
      console.error(`Re-ranking API error (${resp.status}):`, errorText);
      trackAnalytics(
        c,
        (db) => recordRecommendationResults(db, {
          analytics,
          userTextRaw,
          predictedCue: "RECOMMEND",
          predictedIntent: isSurprise ? "surprise" : "recommendation",
          predictedFilters: filters,
          recommendations: results.map((result, index) => ({
            id: typeof result.id === "string" ? result.id : null,
            name: typeof result.name === "string" ? result.name : null,
            brand: typeof result.brand === "string" ? result.brand : null,
            category: result.wine_type || null,
            rankPosition: index + 1,
            sourceKind: "recommendation"
          })),
          preRankedCount: results.length,
          finalRankCount: results.length,
          status: "completed",
          errorCode: "rerank_api_error",
          fallbackReason: `search:${searchFallbackReason}|rerank_api_error`,
          latencyMs: Date.now() - recommendationsStartedAt
        })
      );
      return c.json({
        recommendations: results,
        error: "Showing results without AI ranking.",
        service: "recommendations",
        appliedFilters: appliedSearchFilters,
        fallbackReason: searchFallbackReason
      }, 200);
    }
    const data = await resp.json();
    text = data.choices?.[0]?.message?.content || "";
    tokenUsage = buildTokenUsageResponse(MODEL, data.usage, TIER);
    if (!text || text.trim().length === 0) {
      console.error("Re-ranking API returned empty response");
      trackAnalytics(
        c,
        (db) => recordRecommendationResults(db, {
          analytics,
          userTextRaw,
          predictedCue: "RECOMMEND",
          predictedIntent: isSurprise ? "surprise" : "recommendation",
          predictedFilters: filters,
          recommendations: results.map((result, index) => ({
            id: typeof result.id === "string" ? result.id : null,
            name: typeof result.name === "string" ? result.name : null,
            brand: typeof result.brand === "string" ? result.brand : null,
            category: result.wine_type || null,
            rankPosition: index + 1,
            sourceKind: "recommendation"
          })),
          preRankedCount: results.length,
          finalRankCount: results.length,
          status: "completed",
          errorCode: "rerank_empty_response",
          fallbackReason: `search:${searchFallbackReason}|rerank_empty_response`,
          latencyMs: Date.now() - recommendationsStartedAt
        })
      );
      return c.json({
        recommendations: results,
        error: "Showing results without AI ranking.",
        service: "recommendations",
        appliedFilters: appliedSearchFilters,
        fallbackReason: searchFallbackReason,
        ...tokenUsage ? { tokenUsage } : {}
      }, 200);
    }
    const parseResult = parseRobustJSON(text);
    if (!parseResult.success) {
      console.error("Failed to parse re-ranking response:", {
        error: parseResult.error,
        rawResponse: text?.substring(0, 500)
      });
      trackAnalytics(
        c,
        (db) => recordRecommendationResults(db, {
          analytics,
          userTextRaw,
          predictedCue: "RECOMMEND",
          predictedIntent: isSurprise ? "surprise" : "recommendation",
          predictedFilters: filters,
          recommendations: results.map((result, index) => ({
            id: typeof result.id === "string" ? result.id : null,
            name: typeof result.name === "string" ? result.name : null,
            brand: typeof result.brand === "string" ? result.brand : null,
            category: result.wine_type || null,
            rankPosition: index + 1,
            sourceKind: "recommendation"
          })),
          preRankedCount: results.length,
          finalRankCount: results.length,
          status: "completed",
          errorCode: "rerank_json_parse_error",
          fallbackReason: `search:${searchFallbackReason}|rerank_json_parse_error`,
          latencyMs: Date.now() - recommendationsStartedAt
        })
      );
      return c.json({
        recommendations: results,
        error: "Re-ranking parse error - showing unranked results",
        appliedFilters: appliedSearchFilters,
        fallbackReason: searchFallbackReason,
        ...tokenUsage ? { tokenUsage } : {}
      }, 200);
    }
    const parsedRerank = parseResult.data;
    const rankedIds = parsedRerank.ranked_ids || [];
    const reasoning = parsedRerank.reasoning || "No reasoning provided";
    devLog(c.env, "Re-ranking reasoning:", reasoning);
    const rankedProducts = rankedIds.map((id) => productMap.get(id)).filter((product) => product !== void 0);
    if (rankedProducts.length === 0) {
      trackAnalytics(
        c,
        (db) => recordRecommendationResults(db, {
          analytics,
          userTextRaw,
          predictedCue: "RECOMMEND",
          predictedIntent: isSurprise ? "surprise" : "recommendation",
          predictedFilters: filters,
          recommendations: results.map((result, index) => ({
            id: typeof result.id === "string" ? result.id : null,
            name: typeof result.name === "string" ? result.name : null,
            brand: typeof result.brand === "string" ? result.brand : null,
            category: result.wine_type || null,
            rankPosition: index + 1,
            sourceKind: "recommendation"
          })),
          preRankedCount: results.length,
          finalRankCount: results.length,
          status: "completed",
          fallbackReason: `search:${searchFallbackReason}|no_ranked_ids`,
          latencyMs: Date.now() - recommendationsStartedAt
        })
      );
      return c.json({
        recommendations: results,
        error: "No ranked IDs found - showing unranked results",
        appliedFilters: appliedSearchFilters,
        fallbackReason: searchFallbackReason,
        ...tokenUsage ? { tokenUsage } : {}
      }, 200);
    }
    trackAnalytics(
      c,
      (db) => recordRecommendationResults(db, {
        analytics,
        userTextRaw,
        predictedCue: "RECOMMEND",
        predictedIntent: isSurprise ? "surprise" : "recommendation",
        predictedFilters: filters,
        recommendations: rankedProducts.map((product, index) => ({
          id: typeof product.id === "string" ? product.id : null,
          name: typeof product.name === "string" ? product.name : null,
          brand: typeof product.brand === "string" ? product.brand : null,
          category: product.wine_type || null,
          rankPosition: index + 1,
          sourceKind: "recommendation"
        })),
        preRankedCount: results.length,
        finalRankCount: rankedProducts.length,
        status: "completed",
        fallbackReason: `search:${searchFallbackReason}`,
        latencyMs: Date.now() - recommendationsStartedAt
      })
    );
    return c.json({
      recommendations: rankedProducts,
      preRankedProducts: results,
      reasoning,
      appliedFilters: appliedSearchFilters,
      fallbackReason: searchFallbackReason,
      ...tokenUsage ? { tokenUsage } : {}
    }, 200);
  } catch (err) {
    console.error("Recommendation service error:", err);
    trackAnalytics(
      c,
      (db) => recordRecommendationResults(db, {
        analytics,
        userTextRaw,
        predictedCue: "RECOMMEND",
        predictedIntent: isSurprise ? "surprise" : "recommendation",
        predictedFilters: filters,
        recommendations: results.map((result, index) => ({
          id: typeof result.id === "string" ? result.id : null,
          name: typeof result.name === "string" ? result.name : null,
          brand: typeof result.brand === "string" ? result.brand : null,
          category: result.wine_type || null,
          rankPosition: index + 1,
          sourceKind: "recommendation"
        })),
        preRankedCount: results.length,
        finalRankCount: results.length,
        status: "completed",
        errorCode: "recommendation_service_error",
        fallbackReason: `search:${searchFallbackReason}|recommendation_service_error`,
        latencyMs: Date.now() - recommendationsStartedAt
      })
    );
    return c.json({
      recommendations: results,
      error: "Showing results without AI ranking.",
      service: "recommendations",
      appliedFilters: appliedSearchFilters,
      fallbackReason: searchFallbackReason
    }, 200);
  }
});
app.post("/chat/analytics/event", async (c) => {
  const body = await c.req.json();
  if (!isAnalyticsEnabled(c.env.ANALYTICS_DB)) {
    return c.json({ ok: false, error: "analytics_disabled" }, 503);
  }
  try {
    await recordAnalyticsEvent(c.env.ANALYTICS_DB, {
      eventId: typeof body?.event_id === "string" ? body.event_id : null,
      sessionId: typeof body?.session_id === "string" ? body.session_id : null,
      messageId: typeof body?.message_id === "string" ? body.message_id : null,
      eventType: typeof body?.event_type === "string" ? body.event_type : null,
      productId: typeof body?.product_id === "string" ? body.product_id : null,
      rankPosition: typeof body?.rank_position === "number" ? body.rank_position : null,
      payload: body?.payload,
      occurredAt: typeof body?.occurred_at === "string" ? body.occurred_at : null
    });
    return c.json({ ok: true }, 202);
  } catch (error) {
    console.error("[Chat Analytics] Event write failed:", error);
    return c.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      },
      500
    );
  }
});
app.post("/chat/age-gate-rendered", async (c) => {
  if (!isAnalyticsEnabled(c.env.ANALYTICS_DB)) {
    return c.json({ ok: false, error: "analytics_disabled" }, 503);
  }
  try {
    const body = await c.req.json();
    const sessionId = typeof body?.session_id === "string" ? body.session_id : null;
    const browserToken = typeof body?.browser_token === "string" ? body.browser_token : null;
    if (!sessionId) return c.json({ ok: false, error: "session_id required" }, 400);
    trackAnalytics(c, (db) => recordAgeGateRendered(db, sessionId, browserToken));
    return c.json({ ok: true }, 202);
  } catch (error) {
    return c.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
app.post("/chat/age-confirmed", async (c) => {
  if (!isAnalyticsEnabled(c.env.ANALYTICS_DB)) {
    return c.json({ ok: false, error: "analytics_disabled" }, 503);
  }
  try {
    const body = await c.req.json();
    const sessionId = typeof body?.session_id === "string" ? body.session_id : null;
    const browserToken = typeof body?.browser_token === "string" ? body.browser_token : null;
    if (!sessionId) return c.json({ ok: false, error: "session_id required" }, 400);
    trackAnalytics(c, (db) => recordAgeConfirmed(db, sessionId, browserToken));
    return c.json({ ok: true }, 202);
  } catch (error) {
    return c.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
app.post("/chat/age-declined", async (c) => {
  if (!isAnalyticsEnabled(c.env.ANALYTICS_DB)) {
    return c.json({ ok: false, error: "analytics_disabled" }, 503);
  }
  try {
    const body = await c.req.json();
    const sessionId = typeof body?.session_id === "string" ? body.session_id : null;
    const browserToken = typeof body?.browser_token === "string" ? body.browser_token : null;
    if (!sessionId) return c.json({ ok: false, error: "session_id required" }, 400);
    trackAnalytics(c, (db) => recordAgeDeclined(db, sessionId, browserToken));
    return c.json({ ok: true }, 202);
  } catch (error) {
    return c.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
var index_default = app;
export {
  index_default as default
};
//# sourceMappingURL=index.js.map

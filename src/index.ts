import { deepMerge, isString } from '@minko-fe/lodash-pro'

function joinTimestamp(join: string): string | object {
  if (!join) {
    return ''
  }
  const now = new Date().getTime()
  return `?${join}=${now}`
}

export const CONTENT_TYPE = {
  /**
   * json
   */
  JSON: 'application/json;charset=UTF-8',
  /**
   * form-urlencoded
   * @description
   * form
   */
  FORM_URLENCODED: 'application/x-www-form-urlencoded;charset=UTF-8',
  /**
   * form-data
   * @description
   * upload file
   */
  FORM_DATA: 'multipart/form-data;charset=UTF-8',
}

export const REQUEST_METHODS = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  DELETE: 'DELETE',
  HEAD: 'HEAD',
  OPTIONS: 'OPTIONS',
  PATCH: 'PATCH',
}

type RequestInterceptorType<T extends string = string, U extends FetchOptions = FetchOptions> = (
  url: T,
  options: U,
) => Promise<{ url: T; options: U }> | { url: T; options: U }
type ResponseInterceptorType<T extends Response = Response> = (res: T) => Promise<T> | T
type ErrorInterceptorType<T = any> = (err: T) => T | undefined | void

export interface TransformedResponse<T = any> {
  success: boolean
  response: T
  nativeResponse?: Response
}

export interface FetchInterceptors {
  /**
   * @description
   * request before
   */
  requestInterceptors?: RequestInterceptorType[]
  /**
   * @description
   * response success (e.g. 200)
   */
  responseInterceptors?: ResponseInterceptorType[]
  /**
   * @description
   * response error (e.g. 404, 500)
   */
  errorInterceptors?: ResponseInterceptorType[]
  /**
   * @description
   * network/statement/internal error
   */
  internalErrorInterceptors?: ErrorInterceptorType[]
}

export interface TransformHooks extends FetchInterceptors {
  transformResponseHook?: (res: Response) => TransformedResponse | Promise<TransformedResponse>
}

export interface RequestOptions {
  apiUrl?: string
  urlPrefix?: string
  joinTime?: string
  ignoreRepeatRequest?: boolean
}

export interface FetchOptions extends RequestInit {
  /**
   * @description GET request params
   */
  params?: any
  /**
   * @description POST request data
   */
  data?: any
  requestOptions?: RequestOptions
  transform?: TransformHooks
  method?: keyof typeof REQUEST_METHODS
}

export const defaultTransform: TransformHooks = {
  transformResponseHook: async (res) => {
    try {
      const data = await res.json()

      if (!data) {
        return {
          success: false,
          response: null,
          nativeResponse: res,
        }
      }

      const SUSSCESS_CODES = [200]
      const isSuccess = SUSSCESS_CODES.includes(res.status)

      return {
        success: isSuccess,
        response: data,
        nativeResponse: res,
      }
    } catch (e) {
      return {
        success: false,
        response: null,
        nativeResponse: res,
      }
    }
  },
  requestInterceptors: [
    (url, options) => {
      const { requestOptions, params } = options
      const { apiUrl, joinTime = '', urlPrefix } = requestOptions || {}

      if (urlPrefix && isString(urlPrefix)) {
        url = `${urlPrefix}${url}`
      }

      if (apiUrl && isString(apiUrl)) {
        url = `${apiUrl}${url}`
      }

      if (options.method?.toUpperCase() === REQUEST_METHODS.GET) {
        if (!isString(params)) {
          if (params) {
            const queryString = Object.entries(params)
              .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
              .join('&')
            url = `${url}?${queryString}${joinTimestamp(joinTime)}`
          }
        } else {
          url = `${url + params}${joinTimestamp(joinTime)}`
        }
      } else {
        if (!isString(params)) {
          if (Reflect.has(options, 'data') && options.data && Object.keys(options.data).length > 0) {
            if (options.headers?.['Content-Type'] === CONTENT_TYPE.FORM_URLENCODED) {
              const urlParams = new URLSearchParams()
              for (const key in options.data) {
                if (!options.data[key]) continue
                urlParams.append(key, options.data[key])
              }
              const requestBody = urlParams.toString()
              options.body = requestBody
            }
            if (options.headers?.['Content-Type'] === CONTENT_TYPE.FORM_DATA) {
              const formData = new FormData()
              for (const key in options.data) {
                formData.append(key, options.data[key])
              }
              options.body = formData
            }
            if (options.headers?.['Content-Type'] === CONTENT_TYPE.JSON) {
              options.body = JSON.stringify(options.data)
            }
          } else {
            options.data = params
            options.body = JSON.stringify(params)
          }
        } else {
          url = url + params
        }
      }

      delete options.params
      delete options.data

      return { url, options }
    },
  ],
}

export class NextFetchx {
  private readonly options: FetchOptions
  private readonly interceptors: FetchInterceptors = {}
  private requestInterceptors: RequestInterceptorType[] = []
  private responseInterceptors: ResponseInterceptorType[] = []
  private errorInterceptors: ResponseInterceptorType[] = []
  private internalErrorInterceptors: ErrorInterceptorType[] = []

  static defaultOptions: FetchOptions = {
    method: 'GET',
    headers: { 'Content-Type': CONTENT_TYPE.JSON },
    credentials: 'same-origin',
    mode: 'cors',
    transform: defaultTransform,
    requestOptions: {
      apiUrl: '',
      urlPrefix: '',
      joinTime: '',
    },
  }

  constructor(options?: FetchOptions, interceptors?: FetchInterceptors) {
    this.options = deepMerge(NextFetchx.defaultOptions, options || {})

    this.interceptors = interceptors || {}

    this.setupInterceptors()
  }

  private setupInterceptors() {
    this.interceptors.requestInterceptors?.forEach((t) => {
      this.addRequestInterceptor(t)
    })

    this.interceptors.responseInterceptors?.forEach((t) => {
      this.addResponseInterceptor(t)
    })

    this.interceptors.errorInterceptors?.forEach((t) => {
      this.addErrorInterceptor(t)
    })

    this.interceptors.internalErrorInterceptors?.forEach((t) => {
      this.addInternalErrorInterceptor(t)
    })
  }

  private addRequestInterceptor(interceptor: RequestInterceptorType) {
    this.requestInterceptors.push(interceptor)
  }

  private addResponseInterceptor(interceptor: ResponseInterceptorType) {
    this.responseInterceptors.push(interceptor)
  }

  private addErrorInterceptor(interceptor: ResponseInterceptorType) {
    this.errorInterceptors.push(interceptor)
  }

  private addInternalErrorInterceptor(interceptor: ErrorInterceptorType) {
    this.internalErrorInterceptors.push(interceptor)
  }

  private setupFinalInterceptors(
    transform: TransformHooks | undefined,
    interceptors: FetchInterceptors | undefined,
  ): Required<FetchInterceptors> {
    return {
      requestInterceptors: [
        ...this.requestInterceptors,
        ...(transform?.requestInterceptors || []),
        ...(interceptors?.requestInterceptors || []),
      ],
      responseInterceptors: [
        ...this.responseInterceptors,
        ...(transform?.responseInterceptors || []),
        ...(interceptors?.responseInterceptors || []),
      ],
      errorInterceptors: [
        ...this.errorInterceptors,
        ...(transform?.errorInterceptors || []),
        ...(interceptors?.errorInterceptors || []),
      ],
      internalErrorInterceptors: [
        ...this.internalErrorInterceptors,
        ...(transform?.internalErrorInterceptors || []),
        ...(interceptors?.internalErrorInterceptors || []),
      ],
    }
  }

  async fetch<T = any>(
    url: string,
    options?: FetchOptions,
    interceptors?: FetchInterceptors,
  ): Promise<TransformedResponse<T>> {
    options = deepMerge(this.options, options || {})

    const { transform } = options

    const { transformResponseHook } = transform || {}

    const { requestInterceptors, responseInterceptors, errorInterceptors, internalErrorInterceptors } =
      this.setupFinalInterceptors(transform, interceptors)

    for (const interceptor of requestInterceptors) {
      const interceptorRes = await interceptor(url, options)
      url = interceptorRes.url
      options = interceptorRes.options
    }

    try {
      const res = await fetch(url, options)

      let response = res

      if (res.ok) {
        for (const interceptor of responseInterceptors) {
          response = await interceptor(response)
        }

        if (transformResponseHook) {
          return await transformResponseHook(response)
        }

        return {
          nativeResponse: response,
          response: await response.json(),
          success: response.ok,
        }
      } else {
        for (const interceptor of errorInterceptors) {
          response = await interceptor(res)
        }
        return {
          nativeResponse: response,
          response: (await response.json()) || null,
          success: response.ok,
        }
      }
    } catch (_err) {
      let error = _err
      for (const interceptor of internalErrorInterceptors) {
        error = interceptor(error) || error
      }
      throw error
    }
  }
}

# next-fetchx

## Usage

```ts
import { NextFetchx } from 'next-fetchx'

const nextFetchx = new NextFetchx(
  {
    credentials: 'include',
    requestOptions: {
      apiUrl: 'http://localhost:3000/api',
    },
  },
)

const fetchx = nextFetchx.fetch.bind(nextFetchx)

export { fetchx }
```

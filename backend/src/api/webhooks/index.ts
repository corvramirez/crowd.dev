import { safeWrap } from '../../middlewares/errorMiddleware'

export default (app) => {
  app.post(`/stripe`, safeWrap(require('./stripe').default))
  app.post(`/sendgrid`, safeWrap(require('./sendgrid').default))
  app.post(`/discourse/:tenantId`, safeWrap(require('./discourse').default))
}

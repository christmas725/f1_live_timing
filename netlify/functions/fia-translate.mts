import handler from './fia-translation.mts';
export default async (request:Request,context:any) => request.method === 'POST' ? handler(request,context) : new Response(null,{status:405,headers:{Allow:'POST'}});
export const config={path:'/api/fia-translate',rateLimit:{windowLimit:6,windowSize:3600,aggregateBy:['domain'],action:'rate_limit'}};

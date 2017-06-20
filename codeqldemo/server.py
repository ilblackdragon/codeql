import tornado.httpserver
import tornado.ioloop
import tornado.options
import tornado.web
import tornado.escape

tornado.options.parse_command_line()

class MainHandler(tornado.web.RequestHandler):
    def get(self):
        self.render('templates/main.html')

class SearchHandler(tornado.web.RequestHandler):
    def get(self):
        self.render('templates/search.html', search_term=self.get_argument('q'))

common_handlers = [
    (r'/images/(.*)', tornado.web.StaticFileHandler, {'path': 'images/'}),
    (r'/js/(.*)', tornado.web.StaticFileHandler, {'path': 'js/'}),
]

application = tornado.web.Application([
    (r'/github/tensorflow/tensorflow', MainHandler),
    (r'/github/tensorflow/tensorflow/search', SearchHandler),

] + common_handlers, debug=True, autoreload=True)
http_server = tornado.httpserver.HTTPServer(application, max_buffer_size=1 * 1024 * 1024 * 1024)

http_server.listen(80)
tornado.ioloop.IOLoop.instance().start()

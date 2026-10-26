package app.mnhotel.hotel_reservation_system_backend.controller;
import jakarta.validation.Valid;
import jakarta.servlet.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.*;
import org.springframework.security.core.*;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.csrf.*;
import java.util.Map;
import app.mnhotel.hotel_reservation_system_backend.service.imp.AuthServiceImp;
import app.mnhotel.hotel_reservation_system_backend.dto.*;
@RestController @RequestMapping("/api/auth")
public class AuthController {
    private final AuthServiceImp auth;private final AuthenticationManager manager;private final HttpSessionSecurityContextRepository contexts;private final HttpSessionCsrfTokenRepository csrf;
    public AuthController(AuthServiceImp auth,AuthenticationManager manager,HttpSessionSecurityContextRepository contexts,HttpSessionCsrfTokenRepository csrf){this.auth=auth;this.manager=manager;this.contexts=contexts;this.csrf=csrf;}
    @GetMapping("/csrf") public Map<String,String> token(CsrfToken token){return Map.of("token",token.getToken(),"headerName",token.getHeaderName());}
    @PostMapping("/register") @ResponseStatus(HttpStatus.CREATED) public Views.UserView register(@Valid @RequestBody Requests.Register input){return auth.register(input);}
    @PostMapping("/login") public Views.UserView login(@Valid @RequestBody Requests.Login input,HttpServletRequest request,HttpServletResponse response){
        Authentication result=manager.authenticate(UsernamePasswordAuthenticationToken.unauthenticated(input.username().trim(),input.password()));
        request.getSession(true);request.changeSessionId();
        csrf.saveToken(null,request,response);
        var context=SecurityContextHolder.createEmptyContext();context.setAuthentication(result);SecurityContextHolder.setContext(context);contexts.saveContext(context,request,response);
        return Views.user(auth.require(result.getName()));
    }
    @GetMapping("/me") public Views.UserView me(Authentication authentication){return Views.user(auth.require(authentication.getName()));}
}
